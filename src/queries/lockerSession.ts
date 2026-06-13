import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deliveryApi, lockerApi } from "../api/client";
import { HandInCommandActionEnum, HandOutCommandActionEnum } from "../api/generated";
import type { LockerActionResponse } from "../api/generated";

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
          return (
            await lockerApi.handIn({
              id: sessionId,
              handInCommand: { action: HandInCommandActionEnum.Attempt, barcode },
            })
          ).data;
        case "confirm":
          return (
            await lockerApi.handIn({
              id: sessionId,
              handInCommand: { action: HandInCommandActionEnum.Confirm, barcode },
            })
          ).data;
        case "continue":
          return (
            await lockerApi.handIn({
              id: sessionId,
              handInCommand: { action: HandInCommandActionEnum.Continue },
            })
          ).data;
        case "report-size":
          return (
            await lockerApi.handIn({
              id: sessionId,
              handInCommand: { action: HandInCommandActionEnum.ReportSize },
            })
          ).data;
        case "report-issue":
          return (
            await lockerApi.handIn({
              id: sessionId,
              handInCommand: { action: HandInCommandActionEnum.ReportIssue },
            })
          ).data;
        case "reopen":
          return (
            await lockerApi.handIn({
              id: sessionId,
              handInCommand: { action: HandInCommandActionEnum.Reopen },
            })
          ).data;
        case "finish":
          return (await lockerApi.finish({ id: sessionId })).data;
        case "out-start":
          return (
            await lockerApi.handOut({
              id: sessionId,
              handOutCommand: { action: HandOutCommandActionEnum.Start, barcode },
            })
          ).data;
        case "out-confirm":
          return (
            await lockerApi.handOut({
              id: sessionId,
              handOutCommand: { action: HandOutCommandActionEnum.Confirm, barcode },
            })
          ).data;
        case "out-continue":
          return (
            await lockerApi.handOut({
              id: sessionId,
              handOutCommand: { action: HandOutCommandActionEnum.Continue },
            })
          ).data;
        case "report-missing":
          return (
            await lockerApi.handOut({
              id: sessionId,
              handOutCommand: { action: HandOutCommandActionEnum.ReportMissing, barcode },
            })
          ).data;
        case "abort":
          return (
            await lockerApi.handOut({
              id: sessionId,
              handOutCommand: { action: HandOutCommandActionEnum.Abort },
            })
          ).data;
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["lockerSession", sessionId] });
      void queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
  });
}

export function useRegisterNotDelivered(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (barcode: string) =>
      (
        await deliveryApi.register({
          registerDeliveryRequest: { barcode, status: "NOT_DELIVERED", sessionId },
        })
      ).data,
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["trips"] }),
  });
}

export function useValidate(sessionId: string) {
  return useMutation({
    mutationFn: async (barcode: string) =>
      (await lockerApi.validate1({ id: sessionId, lockerActionRequest: { barcode } })).data,
  });
}
