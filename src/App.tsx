import { Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth";
import { TripListPage } from "./pages/TripListPage";
import { TripDetailPage } from "./pages/TripDetailPage";
import { StopPage } from "./pages/StopPage";
import { SessionPage } from "./pages/SessionPage";
import { MachinePage } from "./pages/MachinePage";

export function App() {
  return (
    <Routes>
      {/* The machine page authenticates too (same demo courier user) but has
          its own kiosk shell — no shared nav with the courier app. */}
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
        element={
          <RequireAuth>
            <TripListPage />
          </RequireAuth>
        }
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
