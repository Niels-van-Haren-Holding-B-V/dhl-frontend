import { useQuery } from "@tanstack/react-query";
import { tripApi } from "../api/client";
import type { TripView } from "../api/types";

// Single source of truth for everything trip/stop/parcel — the locker session
// flow gets its own short-lived query (M3), deliberately NOT merged into this.
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
