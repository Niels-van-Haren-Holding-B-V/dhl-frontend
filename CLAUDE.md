# CLAUDE.md — dhl-frontend

React 19 + TypeScript frontend for the locker integration demo. One codebase,
two faces: the **courier app** (mobile-first, portrait) and the **parcel machine
page** (landscape kiosk + operator console) on route /machine.

Repo: git@github.com:Niels-van-Haren-Holding-B-V/dhl-frontend.git

Shared infrastructure (server, k3s, Keycloak, Postgres, Redpanda, cluster-issuer,
namespace dhl-demo) is owned by the **dhl-backend** repo (/infra there). This repo
only builds its own image and ships two ingresses into that cluster.

## Domains

```
dhl-courier.vanharen-it.nl   # courier app
dhl-locker.vanharen-it.nl    # /machine page — same bundle, second ingress
dhl-api.vanharen-it.nl       # backend (API base URL)
dhl-auth.vanharen-it.nl      # keycloak, realm `courier`
```

## Stack

- Vite, React 19, TypeScript strict, React Router
- TanStack Query v5
- Generated API client from the backend OpenAPI spec
  (openapi-generator `typescript-axios` + axios — the technical review asks for
  a generated client with React Query; `npm run generate` against
  https://dhl-api.vanharen-it.nl/v3/api-docs or localhost:12080 in dev;
  commit the generated client)
- react-oidc-context (or keycloak-js) against realm `courier` at
  https://dhl-auth.vanharen-it.nl — there is NO locker-realm token in the
  browser, ever
- qrcode.react, Tailwind
- PWA manifest (name "Courier", standalone display, theme color #FFCC00) so the
  app installs to a phone home screen and launches without browser chrome

## Theming

DHL-inspired, no DHL logo or wordmark in the UI: header #FFCC00, primary buttons
#D40511, black text, rounded cards, touch targets min 48px. UI copy in Dutch.

## Courier app (mobile-first, ~390px design width)

Screens per the case: Ritoverzicht → Ritvoorvertoning → Pakket inscannen →
Stopoverzicht → Bezorgstatus.

- Single source of truth: `useQuery(['trips'])`, `refetchInterval: 5000`.
- LOCKER stops: locker icon + "Start lockersessie" action.
- Barcode input: text field acting as scanner. Stretch goal (after M7 only):
  camera scanning via html5-qrcode.

### Locker session flow

- Separate short-lived query: `useQuery(['lockerSession', id])`,
  `refetchInterval: 1500`, `enabled: !!activeSessionId`. NEVER merged into the
  trips query — this separation is an interview talking point, keep it obvious.
- Session screen: full-screen QR (qrPayload from backend) + "Wachten op
  koppeling…" until READY.
- Hand-in wizard driven entirely by the last status response — one switch on
  server state, zero client-side state machine. Render:
  scan → validate result (proposed size) → attempt (deur opent) → "Plaats pakket
  en sluit de deur" → continue poll → HANDED_IN ✓.
  - SIZE_PROPOSAL → "Vak te klein — nieuw voorstel: {size}" with retry.
  - Door stuck (continue stays NOT_READY > N polls) → "Deur niet gesloten" with
    reopen / report-issue actions.
  - 503 (circuit open) → friendly Dutch error; parcel falls back to standard
    not-delivered handling.
- Hand-out wizard: start → per COMPARTMENT_OPENED show compartment number,
  confirm per parcel → FINISHED. Buttons: "Pakket ontbreekt" (report-missing),
  "Afbreken" (abort).
- Recovery: all state is server-side; closing and reopening the tab must land
  the wizard on the correct step purely from the refetched status. No
  sessionStorage state. Demoed live (kill tab mid-flow).

## Parcel machine page — /machine (landscape, kiosk + operator console)

Two-pane layout, dark kiosk styling, no shared nav/header with the courier app.
Served on dhl-locker.vanharen-it.nl via its own ingress to the same bundle.

Data source: `useQuery(['simState'])` polling GET /api/sim/state every 1000ms
(authenticated passthrough; the machine page logs in with the same demo courier
user — acceptable for a demo, note it in a comment).

### Left pane — the machine as the courier sees it

- Compartment grid (12 vakken, S/M/L) with live states:
  FREE (dim) | RESERVED (outline) | OCCUPIED (filled) | DOOR_OPEN (animated open,
  pulsing border) | DEFECT (red cross).
- "Scan QR" input: paste/type the QR payload → POST /api/sim/bind. On success a
  short "Gekoppeld" splash.
- Door interactions on a DOOR_OPEN compartment: "Sluit deur" (sim/door CLOSE)
  and "Laat open" (LEAVE_OPEN — courier walked away; feeds the reaper story).

### Right pane — operator console (the demo weapon)

- **State machine inspector**: session state as a horizontal step strip
  (INIT → BOUND → VALIDATED → DOOR_OPEN → CONFIRMED → HANDED_IN), active state
  highlighted, plus the optimistic-lock **version number** ticking up on every
  mutation. On 409/reconcile, flash the version badge.
- **Event log**: last 50 sim events {time, endpoint, summary, resulting state,
  version}, newest on top.
- **Failure injection panel** — toggles wired to POST /api/sim/failures:
  Vak te klein (SIZE_TOO_SMALL), Deur klemt (DOOR_STUCK), Vak defect
  (COMPARTMENT_DEFECT), Pakket ontbreekt (PARCEL_MISSING), Traag netwerk
  (SLOW_NETWORK), Forceer 409 (FORCE_409). Active failures show an amber badge.
- **Reset** button → POST /api/sim/reset.

The console must make cause-and-effect visible: flip "Vak te klein", watch the
courier phone receive SIZE_PROPOSAL, the state strip jump, the version tick,
the event log scroll.

## Demo ergonomics

- Everything reachable without dev tools; /machine link hidden in the courier
  app footer (long-press); reset one click away.
- Both screens side-by-side on a 1080p beamer: courier app in a phone-frame
  container next to the machine page, or two browser windows.

## Build & deploy (cluster is provisioned by dhl-backend/infra — do that first)

- Dockerfile: multi-stage — node build → nginx:alpine serving /dist with an
  SPA fallback (`try_files $uri /index.html`).
- Runtime config: API base URL + Keycloak URL/realm/client via /config.js
  injected by the nginx entrypoint from env vars (no rebuild per environment).
- /deploy/k8s/frontend.yaml: deployment + service + TWO ingresses
  (dhl-courier.vanharen-it.nl and dhl-locker.vanharen-it.nl), both with
  `cert-manager.io/cluster-issuer: letsencrypt` + tls blocks, namespace dhl-demo,
  imagePullSecrets: ghcr.

```bash
# prerequisites: dhl-backend/infra steps 1-6 completed, KUBECONFIG=~/.kube/dhl-demo.yaml
docker build -t ghcr.io/<user>/dhl-frontend:latest . && docker push ghcr.io/<user>/dhl-frontend:latest
kubectl apply -f deploy/k8s/frontend.yaml
kubectl -n dhl-demo get ingress
curl -sI https://dhl-courier.vanharen-it.nl | head -1   # 200, valid TLS
curl -sI https://dhl-locker.vanharen-it.nl | head -1
```

- CI: GitHub Actions builds + pushes ghcr.io/<user>/dhl-frontend on main;
  deploy stays a manual kubectl apply.

## Milestones (mirror backend)

M2 trips UI → M3 QR + machine bind → M4 hand-in happy path on both screens →
M5 failure toggles + state inspector + event log → M6 hand-out → M7 deployed on
both hostnames, PWA installable, demo script runs clean twice in a row.
