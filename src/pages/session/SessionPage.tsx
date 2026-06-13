import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CourierLayout } from "../../components/CourierLayout";
import { QueryGate } from "../../components/QueryGate";
import { PrimaryButton } from "../../components/Buttons";
import { Step } from "../../components/Step";
import {
  useLockerSession,
  useRegisterNotDelivered,
  useSessionAction,
  useValidate,
} from "../../queries/lockerSession";
import { useTrips } from "../../queries/trips";
import { apiErrorCode, apiErrorMessage } from "../../api/client";
import { ScanQrStep } from "./ScanQrStep";
import { ReadyStep } from "./ReadyStep";
import { HandInDoorOpenStep, HandOutDoorOpenStep } from "./DoorOpenSteps";
import { ConfirmStep } from "./ConfirmStep";
import { CompletedStep } from "./CompletedStep";
import type { ParcelView } from "../../api/types";
import type { ValidationResultDto } from "../../api/generated";

const DOOR_STUCK_POLLS = 8;

export function SessionPage() {
  const { tripId, stopId, sessionId } = useParams();
  if (!tripId || !stopId || !sessionId) {
    return (
      <CourierLayout title="Pakketautomaat" backTo="/">
        <p className="py-12 text-center text-neutral-500">Sessie niet gevonden</p>
      </CourierLayout>
    );
  }
  return <SessionWizard tripId={tripId} stopId={stopId} sessionId={sessionId} />;
}

function SessionWizard({ tripId, stopId, sessionId }: { tripId: string; stopId: string; sessionId: string }) {
  const navigate = useNavigate();
  const navState = useLocation().state as { qrPayload?: string; barcode?: string } | null;
  const qrPayload = navState?.qrPayload;

  const { data: trips } = useTrips();
  const stop = trips?.find((t) => t.id === tripId)?.stops.find((s) => s.id === stopId);
  const session = useLockerSession(sessionId);
  const action = useSessionAction(sessionId);
  const validate = useValidate(sessionId);
  const registerNotDelivered = useRegisterNotDelivered(sessionId);

  const [selected, setSelected] = useState<ParcelView | null>(null);
  const [validation, setValidation] = useState<ValidationResultDto | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const [doorOpenPolls, setDoorOpenPolls] = useState(0);
  const autoFired = useRef<string | null>(null);
  const adoptedNavParcel = useRef(false);

  const backTo = `/trips/${tripId}/stops/${stopId}`;
  const simState = session.data?.simState;
  const barcode = selected?.barcode ?? manualBarcode;

  const rearm = () => {
    autoFired.current = null;
    setValidation(null);
    action.reset();
    validate.reset();
  };

  const resetFlow = (next: ParcelView | null = null) => {
    rearm();
    setSelected(next);
    setManualBarcode("");
  };

  useEffect(() => {
    if (!adoptedNavParcel.current && navState?.barcode && stop) {
      adoptedNavParcel.current = true;
      setSelected(stop.parcels.find((p) => p.barcode === navState.barcode) ?? null);
    }
  }, [navState?.barcode, stop]);

  useEffect(() => {
    if (simState !== "READY" || !selected || autoFired.current === selected.barcode) return;
    if (action.isPending || validate.isPending) return;
    autoFired.current = selected.barcode;
    if (selected.direction === "HAND_IN") {
      validate.mutate(selected.barcode, {
        onSuccess: (result) => {
          setValidation(result);
          if (result.valid) action.mutate({ action: "attempt", barcode: selected.barcode });
        },
      });
    } else {
      action.mutate({ action: "out-start", barcode: selected.barcode });
    }
  }, [simState, selected, action, validate]);

  const doorIsOpen = simState === "HAND_IN_DOOR_OPEN" || simState === "HAND_OUT_DOOR_OPEN";
  const polledAt = session.dataUpdatedAt;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDoorOpenPolls((n) => (doorIsOpen ? n + 1 : 0));
  }, [doorIsOpen, polledAt]);

  const actionError = action.error ?? validate.error;
  const doorBlocked = apiErrorCode(actionError) === "DOOR_STILL_OPEN";
  const [waitingForDoorClose, setWaitingForDoorClose] = useState(false);
  const lastDoorRetry = useRef(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tracks an external condition
    if (doorBlocked) setWaitingForDoorClose(true);
    else if (doorIsOpen || !selected) setWaitingForDoorClose(false);
  }, [doorBlocked, doorIsOpen, selected]);
  useEffect(() => {
    if (!doorBlocked || !selected) return;
    if (lastDoorRetry.current === polledAt) return;
    lastDoorRetry.current = polledAt;
    rearm();
  });
  const reconciledOnReady = action.data?.reconciled === true && simState === "READY";
  const cannotDeliver =
    (validation != null && !validation.valid && validation.reason === "NO_CAPACITY") ||
    apiErrorCode(action.error) === "NO_COMPARTMENT_AVAILABLE";
  const openParcels =
    stop?.parcels.filter((p) => p.status === "EXPECTED" || p.status === "NOT_DELIVERED") ?? [];
  const remainingParcels = openParcels.filter((p) => p.barcode !== selected?.barcode);
  const nextParcel = remainingParcels[0] ?? null;

  const finish = () => action.mutate({ action: "finish" });
  const manualScan = () => {
    const parcel = stop?.parcels.find((p) => p.barcode === manualBarcode);
    setValidation(null);
    if (parcel) {
      setSelected(parcel);
    } else {
      validate.mutate(manualBarcode, {
        onSuccess: (result) => {
          setValidation(result);
          if (result.valid) action.mutate({ action: "attempt", barcode: manualBarcode });
        },
      });
    }
  };
  const continueWith = (next: ParcelView | null) => {
    resetFlow(next);
    action.mutate({ action: simState === "HAND_IN_COMPLETED" ? "continue" : "out-continue" });
  };

  return (
    <CourierLayout title="Pakketautomaat" backTo={backTo}>
      <QueryGate isPending={session.isPending} error={session.error}>
        {session.data?.sessionStatus === "EXPIRED" ? (
          <Step title="Sessie verlopen" tone="error">
            <p>De sessie is verlopen. De pakketten volgen de standaard niet-bezorgd afhandeling.</p>
            <PrimaryButton onClick={() => void navigate(backTo)}>Terug naar stop</PrimaryButton>
          </Step>
        ) : simState === "CREATED" ? (
          <ScanQrStep
            qrPayload={qrPayload}
            selected={selected}
            finishBusy={action.isPending}
            onFinish={finish}
          />
        ) : simState === "READY" ? (
          <ReadyStep
            selected={selected}
            openParcels={openParcels}
            validation={validation}
            cannotDeliver={cannotDeliver}
            hasActionError={actionError != null || reconciledOnReady}
            actionBusy={action.isPending}
            validateBusy={validate.isPending}
            registerBusy={registerNotDelivered.isPending}
            manualBarcode={manualBarcode}
            onManualBarcodeChange={setManualBarcode}
            onPick={(p) => {
              setValidation(null);
              setSelected(p);
            }}
            onManualScan={manualScan}
            onRegisterNotDelivered={() =>
              registerNotDelivered.mutate(barcode, { onSuccess: () => resetFlow() })
            }
            onChooseOther={() => resetFlow()}
            onRetry={rearm}
            onFinish={finish}
          />
        ) : simState === "HAND_IN_DOOR_OPEN" ? (
          <HandInDoorOpenStep
            compartmentLabel={action.data?.compartment?.label}
            parcel={selected}
            barcode={barcode}
            stuck={doorOpenPolls > DOOR_STUCK_POLLS}
            busy={action.isPending}
            onReopen={() => action.mutate({ action: "reopen" })}
            onReportIssue={() => action.mutate({ action: "report-issue" }, { onSuccess: rearm })}
            onReportSize={() => action.mutate({ action: "report-size" }, { onSuccess: rearm })}
          />
        ) : simState === "HAND_IN_AWAITING_CONFIRM" ? (
          <ConfirmStep
            direction="HAND_IN"
            parcel={selected}
            barcode={barcode}
            busy={action.isPending}
            onConfirm={() => action.mutate({ action: "confirm", barcode })}
          />
        ) : simState === "HAND_OUT_DOOR_OPEN" ? (
          <HandOutDoorOpenStep
            compartmentLabel={action.data?.compartment?.label}
            parcel={selected}
            barcode={barcode}
            busy={action.isPending}
            onReportMissing={() =>
              action.mutate({ action: "report-missing", barcode }, { onSuccess: () => resetFlow() })
            }
            onAbort={() => action.mutate({ action: "abort" })}
          />
        ) : simState === "HAND_OUT_AWAITING_CONFIRM" ? (
          <ConfirmStep
            direction="HAND_OUT"
            parcel={selected}
            barcode={barcode}
            busy={action.isPending}
            onConfirm={() => action.mutate({ action: "out-confirm", barcode })}
          />
        ) : simState === "HAND_IN_COMPLETED" || simState === "HAND_OUT_COMPLETED" ? (
          <CompletedStep
            direction={simState === "HAND_IN_COMPLETED" ? "HAND_IN" : "HAND_OUT"}
            nextParcel={nextParcel}
            remainingCount={remainingParcels.length}
            busy={action.isPending}
            onNext={() => continueWith(nextParcel)}
            onChooseOther={() => continueWith(null)}
            onFinish={finish}
          />
        ) : simState === "FINISHED" || session.data?.sessionStatus === "FINISHED" ? (
          <Step title="Sessie afgerond" tone="success">
            <PrimaryButton onClick={() => void navigate(backTo)}>Terug naar stop</PrimaryButton>
          </Step>
        ) : (
          <Step title="Bezig…">
            <p className="text-neutral-600">Status: {simState ?? "onbekend"}</p>
          </Step>
        )}

        {action.data?.reconciled && (
          <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
            Status bijgewerkt na een conflict (reconciled) — het scherm toont de actuele toestand.
          </p>
        )}
        {actionError != null && !doorBlocked && (
          <p className="text-dhl-red mt-3 rounded-xl bg-red-50 p-3 text-sm">{apiErrorMessage(actionError)}</p>
        )}
        {waitingForDoorClose && !doorIsOpen && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Er staat nog een deur open op de automaat — zodra die dicht is gaat het vanzelf verder.
          </p>
        )}
      </QueryGate>
    </CourierLayout>
  );
}
