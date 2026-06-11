# dhl-frontend

Courier app + parcel-machine page for the locker-integration demo. One Vite
bundle, two faces: the mobile courier app (`dhl-courier.vanharen-it.nl`) and
the machine kiosk with operator console (`dhl-locker.vanharen-it.nl`, also at
`/machine`). The frontend talks exclusively to the dhl-backend BFF; the
Locker API and Kafka never reach the browser.

The authoritative spec lives in [CLAUDE.md](CLAUDE.md). The backend's API is
browsable at `https://dhl-api.vanharen-it.nl/swagger-ui.html`.

## Run

```bash
# prerequisite: the dhl-backend local stack (see ../dhl-backend/CLAUDE.md)
npm ci
npm run dev        # http://localhost:5173 (courier) and /machine (kiosk)
npm run generate   # regenerate the API client after a backend contract change
npm test           # vitest unit/component tests
npm run test:e2e   # Playwright, needs the backend running on :12080
npm run lint && npm run format:check
```

Login: user `koerier`, password in `../dhl-backend/infra/.env`.

## Demo script (two browser windows)

1. Courier: Ritoverzicht → locker stop → tap a parcel → full-screen QR.
2. Machine: scan the QR with the webcam (or paste it) → "Gekoppeld".
3. The right door opens by itself; close it on the machine; confirm on the
   phone → HANDED_IN, outbox event on Kafka topic `delivery-events`.
4. Operator console: flip failures (vak te klein, deur klemt, 409), announce
   a parcel via the Kafka intake panel, watch the version badge tick.
5. **Reset demo** restores the seeded state for the next run.
