# Codebase Review — dhl-frontend (2026-06-11)

Reviewer stance: external senior engineer, honest assessment. No findings softened.

Coverage: this repo is small enough (~2,700 LOC of hand-written TS/TSX, excluding
the generated API client) that **every source file, every test file, and all
build/deploy/CI configuration was read in full** — no sampling. Gates were run:
`tsc -b` (clean), `eslint .` (clean), `prettier --check .` (clean),
`vitest run` (41/41 pass).

## TL;DR verdict

This is senior-level frontend work. The headline design decision — a locker
wizard with **zero client-side state machine**, rendering purely from polled
server state so a killed tab recovers onto the right step (`src/pages/session/SessionPage.tsx:41-49`,
pinned by a test at `SessionPage.test.tsx:310-316`) — is the kind of choice that
wins a technical interview, and the inline rationale throughout the codebase
shows the author can defend it. The gates are real (strict TS, type-checked
lint rules, behavioural tests, CI that lints/tests/builds/deploys/smoke-checks).
The weaknesses are hygiene, not engineering: **three pushed commits carry the
`Co-Authored-By: Claude` trailer the workspace's own CLAUDE.md explicitly bans**,
there is no README, the largest file (546-line `MachinePage.tsx`) is overdue a
split and is entirely untested, and the spec in CLAUDE.md has drifted from the
implementation in several visible places. None of this sinks the assessment;
all of it is the first thing a sharp assessor will poke at.

## Scorecard

| Dimension | Score /5 | One-line justification |
|---|---|---|
| Readability | 4.5 | Small files, clear naming, exemplary why-comments; one 546-line outlier |
| Structure & architecture | 4 | Clean api/queries/pages/components layering; MachinePage is 9 components in one file |
| Convention adherence | 3.5 | Idiomatic React/TanStack throughout, but its own house rules are violated in git history and touch-target sizing, and the spec has drifted |
| Correctness & robustness | 4 | 401 recovery, circuit-breaker UX, Dutch error mapping, camera-stream cleanup; minor gaps (NaN inputs, no error boundary) |
| Testing | 3.5 | The core wizard and error mapper are excellently tested; the largest file and the trickiest file (auth) have zero tests |
| Maintainability & change-safety | 4 | Strict types, generated client committed, runtime config injection; no README raises onboarding cost |
| Documentation & self-explanation | 3.5 | Inline rationale is outstanding; but no README, and CLAUDE.md no longer matches the code in ~4 places |
| **Overall** | **4** | Solid senior craftsmanship; deductions are discipline/hygiene, not design |

## What's genuinely good (and why)

- **Server-driven wizard, no client state machine** — `SessionPage.tsx:164-268`
  is one flat conditional on `simState`; every mutation just invalidates the
  two queries (`lockerSession.ts:79-82`). This satisfies the single-source-of-truth
  property the case demands, makes the "kill the tab mid-flow" demo trivially
  true, and is *tested as a property* (`SessionPage.test.tsx:310-316` renders
  the page cold with no router state and asserts the right step appears). This
  is the strongest thing in the repo.
- **The one-tap auto-fire is correctly guarded against the real failure modes.**
  `autoFired` ref (`SessionPage.tsx:68,105-119`) prevents re-firing on every
  poll; `adoptedNavParcel` (`SessionPage.tsx:97-102`) prevents re-adopting the
  router-state parcel after "Volgend pakket"; and both hazards are named in
  comments *and* pinned by tests (`SessionPage.test.tsx:176-190`). The
  `resetFlow` comment (`SessionPage.tsx:85-87`) — "the ONE place that owns the
  cleanup ritual" — is exactly the kind of comment that prevents bug classes,
  not describes lines.
- **Comments explain why, almost without exception.** Examples: the OIDC
  redirect-loop rationale (`src/App.tsx:26-28`, `src/auth.tsx:9-11`), the
  springdoc-nullability cast justification (`src/api/types.ts:11-15`), the
  deliberate trips/lockerSession query separation (`src/queries/lockerSession.ts:5-7`),
  the documented `eslint-disable` with its reason (`SessionPage.tsx:125-126`).
  This is dimension-7 behaviour embedded in the code itself.
- **Type discipline above the norm.** `strict` plus `noUncheckedSideEffectImports`,
  `verbatimModuleSyntax` (`tsconfig.app.json`); ESLint runs
  `recommendedTypeChecked` *and* `stylisticTypeChecked` (`eslint.config.js`).
  Zero `any`, zero `@ts-ignore`, zero non-null-assertion chains in app code
  (verified by grep). The `Required<Omit<…>>` view types (`src/api/types.ts:16-21`)
  model the backend's non-null reality once instead of optional-chaining
  everywhere — a thoughtful fix for a real generator limitation.
- **Security posture is right for an OIDC SPA.** Access token lives in a
  module-level variable, never `localStorage`/`sessionStorage` (verified by
  grep; `src/api/client.ts:12`), PKCE public client, one-shot 401 re-login
  latch (`client.ts:20-26,37-43`), and the locker realm genuinely never
  appears in the browser — the machine page only calls `/api/sim/**`
  passthroughs, with the demo trade-off documented in a comment exactly as the
  spec required (`MachinePage.tsx:16-22`).
- **`QrCameraScanner` cleanup is senior-level.** It handles the
  unmount-before-`getUserMedia`-resolves race (`QrCameraScanner.tsx:22-25`),
  stops tracks and cancels the rAF loop on cleanup, and degrades to a Dutch
  error with a manual-input fallback.
- **Tests test behaviour, not implementation.** The wizard suite stubs the
  query hooks and walks server states; assertions are user-visible text and
  mutation contracts. `client.test.ts` covers every branch of the error mapper
  including fallbacks. `QueryGate.test.tsx:16-24` even asserts that raw axios
  English *never* reaches the screen — a negative assertion most teams forget.
- **Deployment is genuinely 12-factor.** One image, runtime `/config.js`
  rendered from env by an nginx entrypoint hook (`deploy/40-config.sh`),
  `no-store` on exactly the two files that must never be cached
  (`deploy/nginx.conf`), readiness probe on `/config.js` itself, two ingresses
  over one bundle, CI gate → image → rollout → smoke check
  (`.github/workflows/build.yml`).

## What's weak (blockers → majors → minors)

### Blockers

- **AI attribution in pushed git history violates the workspace's own rule** —
  commits `adc45d8`, `b363977`, `8fb2aba` carry
  `Co-Authored-By: Claude <noreply@anthropic.com>` trailers. The workspace
  CLAUDE.md states: "commits and PRs carry NO AI attribution". This is a
  violated house rule sitting in permanent, pushed history on `main`. In a
  hiring-assessment context this is the single riskiest artefact in the repo:
  it discloses exactly what the rule was written to keep undisclosed, and an
  assessor running `git log` will find it in seconds. Fix requires a history
  rewrite (`git filter-repo`/interactive rebase + force-push) — disruptive but
  this is a solo demo repo, so do it now or be prepared to own the topic in
  conversation. Actual miss, not house style.

### Majors

- **No README** — repo root. A stranger cloning this gets `package.json` and a
  CLAUDE.md (an AI-tool artefact doing duty as the de facto spec). There is no
  human-facing "what is this, how do I run it, how do I demo it" document. For
  an assessment, the README *is* the front door; its absence costs dimension-7
  marks that the excellent inline comments then have to win back. Actual miss.
- **`MachinePage.tsx` is 546 lines / 9 components in one file** —
  `src/pages/MachinePage.tsx`. The project's median file is ~50 lines; this one
  is 10× that and holds the machine front, door rendering, console slot,
  camera bind flow, state inspector, failure panel, parcel announcer, and event
  log. Internal organisation is good (section comments at lines 44, 315), but
  a `pages/machine/` directory mirroring the existing `pages/session/` pattern
  is clearly the project's own idiom — `session/` got the split, `machine/`
  didn't. Actual miss (inconsistency with its own structure), low risk but
  guaranteed reviewer comment.
- **The largest file and the subtlest file have zero tests.** `MachinePage.tsx`
  (546 lines, all operator-console behaviour) and `src/auth.tsx` (three
  interacting effects: redirect-when-unauthenticated, 401-handler registration,
  auto-retry-on-error with a timer, `auth.tsx:27-51`) are untested. The auth
  recovery logic is exactly the kind of code that regresses silently — commit
  `8fb2aba` ("Guard signinRedirect with activeNavigator") shows it has already
  bitten once, and nothing pins the fix. Actual miss.

### Minors

- **Unchecked cast at the API boundary** — `src/queries/trips.ts:14`
  (`response.data as TripView[]`). The why-comment and the centralisation in
  `api/types.ts` make this defensible house style, and it's the honest
  alternative to optional-chaining soup. But it is still a blind trust: if the
  backend ever omits a "required" field, the failure is a runtime `undefined`
  deep in a component, not a clear boundary error. A zod parse (or generator
  `required` support when springdoc ships it) would convert that to a loud
  failure. Defended-and-questioned, not wrong.
- **Machine-page door controls are far below the documented 48px touch
  target** — `MachinePage.tsx:166-178` ("Sluit"/"Laat open" are
  `text-[10px] px-1.5 py-0.5`). CLAUDE.md's theming section says "touch targets
  min 48px". The courier app honours it everywhere (`min-h-12` in
  `Buttons.tsx`, `StopPage.tsx`); the kiosk page doesn't. Arguably the rule was
  meant for the phone app and the kiosk is a desktop demo — but that
  distinction is not written down, so as it stands it's a violated house rule.
  Either scope the rule in CLAUDE.md or fix the buttons.
- **Auto-fire effect dependencies overstate reactivity** —
  `SessionPage.tsx:119` lists `action` and `validate` (new object identities
  every render) in the deps, so the effect actually runs every render and
  correctness rests entirely on the `autoFired` ref. It works and is tested,
  but the deps array implies a contract it doesn't have; extracting
  `action.isPending`/`mutate` or noting this in the existing comment would
  remove a "walk me through why this can't double-fire" interview trap.
- **NaN can be submitted from the announce panel** — `MachinePage.tsx:494`:
  clearing a number input yields `Number("") = 0`, but typing `-`/`e`
  intermediate states yield `NaN`; the submit button only checks `barcode`.
  The backend will judge it, but a `disabled` guard is one line.
- **Splash timer not cleaned up** — `MachinePage.tsx:242`: the 2s `setTimeout`
  in `doBind` is never cleared; harmless today (no-op setState after unmount)
  but it's the only uncleaned timer in a codebase that otherwise cleans up
  religiously.
- **`scannerBeep` can be silently suspended** — `scannerBeep.ts`: when called
  from the camera-scan path (`MachinePage.tsx:249-255`) there is no user
  gesture, so autoplay policy may leave the `AudioContext` suspended and the
  beep silently absent. Cosmetic for a demo; worth knowing before the live run.
- **No error boundary** — `src/main.tsx`. A render-time exception anywhere
  yields a white screen. Same for a missing `/config.js` (`src/config.ts:20`
  throws at import). Fail-fast is defensible for a demo; a one-component
  boundary with a Dutch message would cost 20 lines.
- **CI deploys `:latest` + `rollout restart` instead of pinning the SHA tag it
  just built** — `.github/workflows/build.yml:46-49,72-74`. The SHA tags exist
  and go unused. The `concurrency` group mitigates the race, but pinning
  `:$GITHUB_SHA` via `kubectl set image` would make deploys reproducible and
  rollbackable for free.
- **Hashed assets get no cache headers** — `deploy/nginx.conf` sets `no-store`
  on the right two files but nothing on `/assets/*`, so Vite's
  content-hashed bundles are revalidated instead of cached immutable. One
  `location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }`.

## Design choices — defended and questioned

- **No client-side state machine for the wizard.** Reason: server state is the
  only truth; recovery after tab-kill comes for free; one switch is auditable.
  Cost: the UI can only be as fresh as the 1.5s poll, transient details
  (compartment label) live in mutation responses and vanish on reload —
  handled gracefully via conditional render (`DoorOpenSteps.tsx:31`). A senior
  accepts this trade instantly for this domain; the rationale is written where
  it matters. **Strong, survives questioning.**
- **Polling (1s/1.5s/5s) instead of SSE/WebSocket.** Never stated explicitly in
  the frontend docs, but the tiered intervals and deliberate query separation
  (`lockerSession.ts:5-7`) show intent. Cost: up to 1.5s perceived lag on the
  demo beamer and N×3600 requests/hour. For a two-screen demo this is the
  right call; be ready to say "SSE is the production answer, polling is the
  demo answer" out loud. **Defensible, needs the one-liner ready.**
- **Generated axios client, committed.** Required by the case, done per spec,
  generated code excluded from lint (`eslint.config.js:10`). Cost: regeneration
  discipline is manual (`npm run generate` against a live backend); nothing in
  CI verifies the committed client matches the backend's current spec. A drift
  check (generate in CI, `git diff --exit-code`) would close the loop.
  **Defensible; the gap is verifiable drift.**
- **Machine page logs in as the courier user.** Acknowledged trade-off,
  documented in the exact place the spec demanded (`MachinePage.tsx:16-22`).
  **Defensible as scoped.**
- **`Required<…>` view-type layer over the generated DTOs.** Clever, documented,
  centralised. The alternative (runtime validation) is heavier; the chosen
  trade is reasonable for a demo against a backend the same author owns.
  **Defensible.**
- **Light schematic machine design vs the spec's "dark kiosk styling".**
  Commit `54a826a` deliberately went light/schematic and the result (true-to-scale
  doors, `DOOR_PITCH_CM` mirrored with the backend, `MachinePage.tsx:135-153`)
  is better than the spec. But the spec was never updated — see below.

## Test reality check

41 tests, 3 files, all behavioural — quality is high where it exists:

- **Covered well:** the entire session wizard (route guard, every `simState`
  branch, one-tap auto-fire idempotency, size escalation, NO_CAPACITY dead-end,
  door-stuck threshold, hand-out, killed-tab recovery, reconcile banner, Dutch
  error fallbacks) and the full error-mapping matrix.
- **Dangerously uncovered:** `auth.tsx` — the most failure-prone file (already
  produced one bug-fix commit) with timer-driven retry logic and effect
  interplay; `MachinePage.tsx` — 546 lines including the bind flow, failure
  toggles and version-flash logic that the demo script depends on; and there is
  no integration/E2E pass, so the contract between the real query hooks and the
  wizard (everything the mocks paper over: invalidation timing, refetch
  intervals) is unverified. For the live demo, the machine page is the screen
  most likely to embarrass and least protected by tests.
- Tautology check: passed — assertions are user-visible strings and mutation
  payloads, not mock-echoes. `SessionPage.test.tsx:184-189` (re-render three
  polls, assert *not* called again) is a genuinely good negative test.

## Spec drift (CLAUDE.md vs implementation)

The repo's own spec no longer matches the code in four places. None are code
bugs; all are documentation debt an assessor reading CLAUDE.md first will trip
over:

1. "/machine link hidden in the courier app footer (long-press)" — no footer
   exists (`CourierLayout.tsx`); the hostname-routing approach (`App.tsx:11-12`)
   superseded it. Update the doc.
2. "dark kiosk styling" — the machine page is deliberately light/schematic.
3. State strip "INIT → BOUND → VALIDATED → DOOR_OPEN → CONFIRMED → HANDED_IN" —
   implemented with the real backend states and Dutch labels
   (`MachinePage.tsx:340-347`), hand-out shown as a text line, not strip steps.
4. "camera scanning via html5-qrcode" (stretch) — implemented with `jsqr`, and
   on the machine page rather than the courier barcode field.

## The verdict — answered directly

**Would this pass an external/hiring assessment? Yes — this reads as senior
frontend work, and the author's ability to explain the choices is visible in
the code itself.** The architecture decision that matters (server-state-driven
wizard) is correct, deliberate, documented, and tested as a property. The
tooling discipline (strict TS, type-checked lint, behavioural tests, real CI
gate, runtime config) is above what most demo projects ship.

What an assessor will likely conclude: strong product-minded senior with
excellent communication-through-code; slightly thin on test breadth and repo
hygiene. Ranked list of what to fix or be ready to defend in person:

1. **Rewrite the three attributed commits out of history** (`adc45d8`,
   `b363977`, `8fb2aba`) — or decide, consciously, to own the AI-assistance
   conversation. Do not leave this to be discovered.
2. **Add a README** — 30 lines: what, run, demo script, link to CLAUDE.md.
3. **Be ready to defend:** the `as TripView[]` cast (your written rationale is
   good — say it out loud), polling vs SSE, the courier-user-on-the-kiosk
   trade-off, and why the wizard has no client state machine (your best
   material — lead with it).
4. **Sync CLAUDE.md with reality** (four drift points above) — cheap, and
   drift undermines the otherwise-excellent documentation story.
5. **Split MachinePage** into `pages/machine/` and put at least smoke tests on
   the failure panel and bind flow before the live demo.

## If I had 2 days / 2 weeks to raise the grade

**2 days (highest leverage first):**
1. History rewrite to remove the AI attribution trailers; force-push.
2. README.md with run + demo script.
3. Update CLAUDE.md's four stale spec points.
4. Tests for `auth.tsx` (the retry/redirect effects) and a MachinePage smoke
   suite (bind, failure toggle, version flash).
5. One-line fixes: NaN guard on announce inputs, splash-timer cleanup, error
   boundary, immutable cache headers for `/assets/`.

**2 weeks:**
1. Split `MachinePage.tsx` into `pages/machine/` components with tests per pane.
2. Pin CI deploys to the SHA tag; add an OpenAPI-drift check (regenerate +
   `git diff --exit-code`) so the committed client can't silently rot.
3. A thin Playwright E2E running the happy hand-in path against the local
   backend — the one test class that would catch contract breaks the unit
   mocks can't see.
4. Replace polling with SSE behind the same query keys (and keep the polling
   fallback) — turns a defensive interview answer into an offensive one.
5. Zod-validate the trips response at the boundary, replacing the cast.
