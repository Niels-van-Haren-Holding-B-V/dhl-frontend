import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lockerApi } from "../api/client";
import type { LockerActionResponse } from "../api/generated";

// Deliberately a SEPARATE short-lived query, never merged into ['trips']:
// the trips list refreshes at its own 5s pace; an active locker session
// needs a much tighter 1.5s loop and disappears when the session ends.
export function useLockerSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["lockerSession", sessionId],
    queryFn: async () => (await lockerApi.status1({ id: sessionId! })).data,
    refetchInterval: 1500,
    enabled: !!sessionId,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stopId: string) => (await lockerApi.create({ createSessionRequest: { stopId } })).data,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["trips"] }),
  });
}

/**
 * One mutation for every wizard action. The wizard renders purely from server
 * state, so each action just fires and refreshes both queries; the response
 * is kept by the caller only for transient details (compartment, reconciled).
 */
export function useSessionAction(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      action,
      barcode,
    }: {
      action:
        | "attempt"
        | "confirm"
        | "continue"
        | "report-size"
        | "report-issue"
        | "reopen"
        | "finish"
        | "out-start"
        | "out-confirm"
        | "out-continue"
        | "report-missing"
        | "abort";
      barcode?: string;
    }): Promise<LockerActionResponse> => {
      switch (action) {
        case "attempt":
          return (await lockerApi.attempt1({ id: sessionId, lockerActionRequest: { barcode } })).data;
        case "confirm":
          return (await lockerApi.confirm1({ id: sessionId, lockerActionRequest: { barcode } })).data;
        case "continue":
          return (await lockerApi.handInContinue({ id: sessionId })).data;
        case "report-size":
          return (await lockerApi.reportSize1({ id: sessionId })).data;
        case "report-issue":
          return (await lockerApi.reportIssue1({ id: sessionId })).data;
        case "reopen":
          return (await lockerApi.reopen1({ id: sessionId })).data;
        case "finish":
          return (await lockerApi.finish({ id: sessionId })).data;
        case "out-start":
          return (await lockerApi.handOutStart1({ id: sessionId, lockerActionRequest: { barcode } })).data;
        case "out-confirm":
          return (await lockerApi.handOutConfirm1({ id: sessionId, lockerActionRequest: { barcode } })).data;
        case "out-continue":
          return (await lockerApi.handOutContinue1({ id: sessionId })).data;
        case "report-missing":
          return (await lockerApi.reportMissing({ id: sessionId, lockerActionRequest: { barcode } })).data;
        case "abort":
          return (await lockerApi.abort({ id: sessionId })).data;
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["lockerSession", sessionId] });
      void queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
  });
}

export function useValidate(sessionId: string) {
  return useMutation({
    mutationFn: async (barcode: string) =>
      (await lockerApi.validate1({ id: sessionId, lockerActionRequest: { barcode } })).data,
  });
}
