import { Route, Routes } from "react-router-dom";
import config from "./config";
import { RequireAuth } from "./auth";
import { TripListPage } from "./pages/TripListPage";
import { TripDetailPage } from "./pages/TripDetailPage";
import { StopPage } from "./pages/StopPage";
import { SessionPage } from "./pages/session/SessionPage";
import { MachinePage } from "./pages/machine/MachinePage";

export function App() {
  // One bundle, two faces: on the locker hostname the root IS the machine page.
  const isMachineHost = !!config.machineHostname && window.location.hostname === config.machineHostname;

  return (
    <Routes>
      {/* The machine page authenticates with the same courier user but has
          its own kiosk shell — no shared nav with the courier app. */}
      <Route
        path="/machine"
        element={
          <RequireAuth>
            <MachinePage />
          </RequireAuth>
        }
      />
      {/* No redirect here: a redirect at / would strip the ?code&state of the
          OIDC callback before the library exchanges it (login loop). On the
          locker hostname / simply IS the machine page. */}
      <Route
        path="/"
        element={<RequireAuth>{isMachineHost ? <MachinePage /> : <TripListPage />}</RequireAuth>}
      />
      <Route
        path="/trips/:tripId"
        element={
          <RequireAuth>
            <TripDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/trips/:tripId/stops/:stopId"
        element={
          <RequireAuth>
            <StopPage />
          </RequireAuth>
        }
      />
      <Route
        path="/trips/:tripId/stops/:stopId/session/:sessionId"
        element={
          <RequireAuth>
            <SessionPage />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
