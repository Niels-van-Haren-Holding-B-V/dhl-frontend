import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { simApi } from "../api/client";
import type { DoorRequestActionEnum, FailureRequestModeEnum, ParcelAnnouncement } from "../api/generated";

export function useSimState() {
  return useQuery({
    queryKey: ["simState"],
    queryFn: async () => (await simApi.state1()).data,
    refetchInterval: 1000,
  });
}

function useSimMutation<TArgs = void>(fn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["simState"] }),
  });
}

export function useBind() {
  return useSimMutation((qrCode: string) => simApi.bind1({ bindRequest: { qrCode } }));
}

export function useDoor() {
  return useSimMutation(
    ({ compartmentNr, action }: { compartmentNr: number; action: DoorRequestActionEnum }) =>
      simApi.door1({ doorRequest: { compartmentNr, action } }),
  );
}

export function useFailureToggle() {
  return useSimMutation(({ mode, enabled }: { mode: FailureRequestModeEnum; enabled: boolean }) =>
    simApi.failures1({ failureRequest: { mode, enabled } }),
  );
}

export function useSimReset() {
  return useSimMutation((_: void) => simApi.reset1());
}

export function useAnnounceParcel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (announcement: ParcelAnnouncement) =>
      simApi.announceParcel({ parcelAnnouncement: announcement }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["trips"] }),
  });
}
