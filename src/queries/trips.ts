import { useQuery } from "@tanstack/react-query";
import { tripApi } from "../api/client";
import type { TripView } from "../api/types";

// Single source of truth for everything trip/stop/parcel. The locker session
// flow has its own short-lived query, deliberately not merged into this one:
// it polls faster and disappears when the session ends.
export function useTrips() {
  return useQuery({
    queryKey: ["trips"],
    queryFn: async () => {
      const response = await tripApi.trips();
      // See api/types.ts for why this cast is safe.
      return response.data as TripView[];
    },
    refetchInterval: 5000,
  });
}
