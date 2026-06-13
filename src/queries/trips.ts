import { useQuery } from "@tanstack/react-query";
import { tripApi } from "../api/client";
import type { TripView } from "../api/types";

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
