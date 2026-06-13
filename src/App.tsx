import { Route, Routes } from "react-router-dom";
import config from "./config";
import { RequireAuth } from "./auth";
import { TripListPage } from "./pages/TripListPage";
import { TripDetailPage } from "./pages/TripDetailPage";
import { StopPage } from "./pages/StopPage";
import { SessionPage } from "./pages/session/SessionPage";
import { MachinePage } from "./pages/machine/MachinePage";

export function App() {
  const isMachineHost = !!config.machineHostname && window.location.hostname === config.machineHostname;

  return (
    <Routes>
      <Route
        path="/machine"
        element={
          <RequireAuth>
            <MachinePage />
          </RequireAuth>
        }
      />
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
