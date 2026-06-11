# Codebase Review — dhl-frontend (2026-06-11)

Reviewer stance: external senior engineer, honest assessment. No findings softened.

Scope: entire hand-written codebase read (~1,800 LOC of TypeScript/TSX
excluding the committed generated API client; every page, query module,
component, the auth/config/client layer, Dockerfile, nginx config, deploy
manifest, and CI workflow were read in full — this is not a sampled review).
Gates run: `tsc -b --force` (clean), `eslint .` (clean). Greps: zero `any`,
zero `@ts-ignore`, zero `console.log`, zero `localStorage`/`sessionStorage`
in source, zero `dangerouslySetInnerHTML`.

## TL;DR verdict

Solid senior-level frontend *code* with one mid-level-shaped hole: there is
not a single test in the repository — no runner, no script, no test file —
and the repo contains exactly the kind of stateful wizard logic that tests
exist for. The single best thing is the architecture decision the whole app
hangs on: the locker wizard has no client-side state machine at all; every
render is one switch on the server's polled state, which makes the
documented kill-the-tab recovery a structural property instead of a feature
that can regress. The single worst thing is that nothing protects that
537-line switch from regressing except a human clicking through a demo. An
assessor will praise the design and then ask, "and where are the tests for
it?" — and there is no answer.

## Scorecard

| Dimension | Score /5 | One-line justification |
|---|---|---|
| Readability | 4.5 | Why-comments at every trap, clean naming, strict types; two page files are dense multi-component scrolls |
| Structure & architecture | 4.5 | Server-state-driven wizard, clean pages/queries/api/components layering, runtime-config pattern done right |
| Convention adherence | 4.5 | Its own spec followed almost to the letter (one drifted item); idiomatic React 19 + TanStack Query v5 throughout |
| Correctness & robustness | 4 | Recovery-by-refetch is genuinely robust; subtle ref-guarded effects and assertion-heavy param handling carry quiet risk |
| Testing | 1 | Zero tests, zero test infrastructure; the score is for absence, not quality |
| Maintainability & change-safety | 3.5 | Small clear modules, generated client; but any change to SessionPage is verified only by hand |
| Documentation & self-explanation | 4.5 | CLAUDE.md is a real spec, decisions annotated inline; no README at the repo root |
| **Overall (testing-weighted)** | **3.5–4** | Senior design and execution, undermined by a professional-bar gap in verification |

## What's genuinely good (and why)

- **The no-client-state-machine wizard.** `SessionPage.tsx:22-31` states the
  rule — "every render is one switch on the server's simState from the 1.5s
  status poll. Kill the tab, reopen this URL, and the wizard lands on the
  correct step" — and the body honours it: one ternary chain over `simState`
  (`SessionPage.tsx:111-436`), no step counter, no persisted wizard state, no
  `sessionStorage` (verified by grep). This is the separation-of-concerns
  property at its best: the server owns truth, the client owns rendering, and
  the recovery requirement in CLAUDE.md falls out for free.
- **Query design matches the documented intent exactly.** The trips query
  polls at 5s (`queries/trips.ts:13-16`); the session query is separate,
  1.5s, gated on an active id (`queries/lockerSession.ts:8-16`) — with the
  comment explaining *why* they must never merge. The machine page renders
  entirely from one 1s `simState` snapshot (`queries/simState.ts:6-13`).
  Every mutation invalidates the queries it affects via `onSettled`
  (`lockerSession.ts:80-84`), the correct TanStack v5 idiom for "the server
  moved, refetch truth".
- **The generated-client nullability problem solved once, not everywhere.**
  springdoc emits all-optional fields for Kotlin non-null DTOs;
  `api/types.ts:11-23` documents this, builds `Required<>`-mapped view types,
  and the cast happens in exactly one place (`queries/trips.ts:14-15`) instead
  of optional-chaining through every component. This is the right altitude
  for a workaround: one annotated seam, zero scattered `!`.
- **Token handling is correct for a SPA.** The access token lives in a module
  variable pushed from the auth context (`api/client.ts:11-17`,
  `auth.tsx:28-30`); grep confirms no `localStorage`/`sessionStorage` use in
  source. The machine page's "same demo courier user" shortcut is documented
  as an accepted demo trade-off in the exact place a reviewer would look
  (`MachinePage.tsx:11-14`), as CLAUDE.md required.
- **Hard-won bugs are pinned with comments where they'd regress.** The OIDC
  redirect/login-loop trap is explained twice — at the redirect URI choice
  (`auth.tsx:9-12`) and at the route that deliberately does *not* redirect
  (`App.tsx:28-30`); the one-shot parcel adoption explains the re-fire bug it
  prevents (`SessionPage.tsx:59-67`); the lint suppression carries its
  justification (`SessionPage.tsx:90-91`). Comments-as-regression-tests is
  not a substitute for tests, but it is exactly what dimension-1 comment
  quality means.
- **Error UX is designed, not defaulted.** A single `apiErrorMessage` maps
  503 to the circuit-breaker message, 422 rejection codes to actionable Dutch
  (`api/client.ts:31-63`); the wizard branches on `apiErrorCode` for the
  cannot-deliver dead end (`SessionPage.tsx:98-100`) and surfaces
  `reconciled: true` to the user (`SessionPage.tsx:438-442`). Loading and
  error states are uniform via `QueryGate`.
- **The camera scanner cleans up after itself.** `QrCameraScanner.tsx:13-57`:
  an `active` flag covering the getUserMedia/unmount race, `cancelAnimationFrame`,
  track stopping in the effect cleanup, and a stop for the late-arriving
  stream. Effects-with-cleanup is on every reviewer checklist; this one passes.
- **Ops plumbing done properly for a static SPA.** Runtime config via
  `/config.js` rendered by an nginx entrypoint (`deploy/40-config.sh`) so one
  image serves all environments; `no-store` on `config.js` and `index.html`
  with hashed assets cacheable (`deploy/nginx.conf`); readiness probe on the
  rendered config; memory limits set (`deploy/k8s/frontend.yaml:33-41`); a
  fail-fast error if the config is missing (`config.ts:20-22`).

## What's weak (ordered: blockers → majors → minors)

### Blocker (for the professional bar, not for the demo)

1. **Zero tests, zero test infrastructure** — `package.json` (no test
   script, no test dependency; CI runs lint + format + build only,
   `.github/workflows/build.yml:22-27`). This is not a coverage shortfall;
   it is the absence of the practice. The repo's core asset — the
   `simState` switch with its escalation paths (`SessionPage.tsx:111-436`),
   the auto-fire effect (`:70-84`), the cannot-deliver detection (`:98-100`),
   `apiErrorMessage`'s status mapping (`api/client.ts:43-63`) — is all pure
   enough to be cheaply testable (render with a mocked query state, assert
   the step shown), and none of it is. Why a reviewer cares: any refactor of
   SessionPage is verified only by manually re-running the demo script, and
   the backend repo *does* meet its testing bar, which makes the asymmetry
   conspicuous. Not defensible as house style: CLAUDE.md is silent on
   frontend testing, and silence is not a documented trade-off. Fix:
   Vitest + Testing Library; even ~10 tests over the wizard switch and the
   error mapper would change the assessment materially.

### Majors

2. **`SessionPage.tsx` is 537 lines holding seven components and all wizard
   logic** — `SessionPage.tsx:32-537` (and `MachinePage.tsx` at 458 lines,
   nine components). Cohesive, yes; but `Step`, `PrimaryButton`,
   `SecondaryButton`, `ParcelCard` are generic UI defined privately in one
   page while `StopPage.tsx:74-78` re-implements the same button styling
   inline — the duplication signal that says the extraction is overdue. No
   documented size cap exists in this repo (the author's other projects cap
   at 300), so this costs style points, not rule points. Fix: move the four
   shared primitives to `components/`, split the wizard steps into a
   `session/` folder.
3. **State reset rituals are copy-pasted and divergence-prone.** The
   four-line cleanup (`setSelected(null); setValidation(null);
   autoFired.current = null; action.reset()…`) appears in five variations
   (`SessionPage.tsx:155-162, 168-174, 186-189, 199-203, 397-415`). Each new
   wizard exit needs the author to remember all the pieces — this is exactly
   how the "retry fires the stale parcel" class of bug comes back. Fix: one
   `resetFlow()` helper (or a reducer) owning the ritual.

### Minors

4. **Non-null assertions where the type system is being overruled** —
   `sessionId!` ×3 (`SessionPage.tsx:43-45`) on a `useParams` value that is
   `undefined` on a malformed URL; `c.nr!` (`MachinePage.tsx:161,167`).
   Each is locally safe today (`enabled: !!sessionId` guards the query;
   `nr` is always set by the backend) but they are runtime trust where a
   guard clause (`if (!sessionId) return <NotFound/>`) would be free.
5. **The auto-fire effect leans on a ref flag against re-entry** —
   `SessionPage.tsx:70-84`. Mutation objects in the dependency array make
   the effect re-run every poll; `autoFired.current` is the only thing
   preventing duplicate attempts. It works, and the guard is tight, but
   it is the second-most-subtle code in the repo protected only by
   finding 1's missing tests.
6. **Event-log list keys are partially index-based** —
   `MachinePage.tsx:446` (`key={`${e.ts}-${i}`}`) on a reversed array.
   Same-timestamp entries shift keys as the ring buffer scrolls. Harmless
   for display-only rows; still the checklist item it is.
7. **Raw `error.message` shown to users in `QueryGate`** —
   `QueryGate.tsx:17-22`. Axios's English "Request failed with status code
   401" reaches an otherwise fully Dutch UI; `apiErrorMessage` exists and
   isn't used here.
8. **Spec drift: the hidden long-press `/machine` link in the courier footer
   (CLAUDE.md "Demo ergonomics") is not implemented** — no footer exists in
   `CourierLayout.tsx`. Tiny, but it is a documented requirement of this
   repo's own spec, and the spec is otherwise followed closely enough that
   the gap looks like an oversight rather than a decision. (The other
   nominal drift — jsQR instead of html5-qrcode — is fine: camera scanning
   was a stretch goal and the implementation is sound.)
9. **No README.md.** CLAUDE.md carries everything, but a repo root without a
   README fails the five-second "how do I run this" test for anyone who
   doesn't know the convention; the backend repo has one. Three lines would do.

## Design choices — defended and questioned

- **Server-driven wizard over a client state machine.** Reason: recovery and
  truth live on the server; the demo kills the tab mid-flow on purpose.
  Cost: every step transition takes up to one poll interval (1.5s) to render,
  and transient response details (compartment number, `reconciled`) must be
  carried in mutation results outside the polled state
  (`lockerSession.ts:26-30`) — a small, documented impurity. Verdict: a
  senior takes this trade happily at these poll rates; be ready to answer
  "why not SSE/WebSocket" (answer: polling is the deliberately boring choice
  for a demo with a 1.5s budget — say it that confidently).
- **Generated axios client, committed.** Required by the case, and committing
  it makes builds hermetic (no live backend needed in CI). Cost: it can drift
  from the deployed API silently, the numbered method names (`status1`,
  `attempt1`) leak the backend's overload structure, and nothing in CI
  regenerates-and-diffs. Acceptable; a `generate && git diff --exit-code` CI
  step would close the drift hole cheaply.
- **Same demo-courier login for the machine page.** Documented trade-off at
  the point of use with the real-world alternative named
  (`MachinePage.tsx:11-14`); the locker realm verifiably never reaches the
  browser (all machine traffic goes to `/api/sim/**`). Accepted as argued.
- **Runtime config via `window.__APP_CONFIG__`.** One image, every
  environment; blocking script before the bundle; fail-fast when missing.
  The cost (one extra render-blocking request) is the right price; this is
  the standard professional pattern and it's executed completely (no-store,
  readiness probe on the file).
- **Tailwind utility classes inline, no design-system layer.** Fast and
  consistent at this size; the repeated button/badge recipes are the first
  thing to outgrow it (see finding 2). At ~1,800 LOC the trade is fine; the
  reviewer's question is whether the author knows where the line is — the
  StopPage duplication says it's already been crossed by a step.

## Test reality check

Nothing is covered. The critical paths in this repo — the wizard switch over
server state, the auto-fire one-tap flow, escalation (size-too-small →
bigger door → cannot-deliver → register-not-delivered), error mapping, OIDC
gate behaviour — have zero automated verification. The compensating controls
are real but partial: TypeScript strict with zero `any` removes a whole bug
class, ESLint with the react-hooks rules is green, and the backend
integration test exercises the API contract the frontend consumes. None of
that catches a wrong branch in a ternary chain. This is the gap between
"the code is good" and "the code is safe to change".

## The verdict

No explicit question accompanied this audit, so: **is this professional?**
The code, architecture, and ops setup — yes, comfortably senior: deliberate
data-flow design, documented trade-offs, strict typing, clean tooling. The
engineering *practice* has one hole a professional reviewer will not let
pass: a stateful, branch-heavy UI with zero tests. In an assessment, expect
exactly one hard question — "how do you know SessionPage still works after a
change?" — and currently the only honest answer is "I click through the
demo". Everything else in this review is polish; that one is the grade.

Ranked list to fix or be ready to defend:

1. Add a minimal Vitest + Testing Library suite over the wizard switch and
   `apiErrorMessage`, and wire it into CI (finding 1). This single change
   moves the overall grade from "strong code, mid-level process" to
   "senior across the board".
2. Extract the shared UI primitives and a `resetFlow()` helper (findings 2-3).
3. Implement or delete the footer long-press spec item; add a README
   (findings 8-9).
4. Be ready to explain, with confidence: polling vs push, the committed
   generated client, and the machine-page identity — the written rationale
   already carries these.

## If I had 2 days / 2 weeks to raise the grade

**2 days:**
1. Vitest + Testing Library; ~12 tests: one per `simState` branch of the
   wizard (mock `useLockerSession`), the cannot-deliver dead end, and
   `apiErrorMessage`/`apiErrorCode` table tests. Add `npm test` to CI.
2. `resetFlow()` helper replacing the five copy-pasted cleanups.
3. Route `QueryGate` errors through `apiErrorMessage`; guard-clause the
   `useParams` assertions.
4. Three-line README; footer long-press link or a one-line CLAUDE.md edit
   removing the requirement.

**2 weeks:**
1. Split `SessionPage` into `pages/session/` step components with the shared
   primitives in `components/` — *after* the tests exist, as the refactor
   that proves their worth.
2. Playwright smoke against the local stack: login → trip → session →
   bind → hand-in happy path on both screens (the demo script, automated —
   it also guards the backend contract).
3. CI step regenerating the API client against the backend's `/v3/api-docs`
   and failing on diff.
4. An ErrorBoundary around the route tree so a render crash in the kiosk
   degrades to a reload prompt instead of a white screen at a live demo.
