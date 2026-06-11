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

// How many status polls HAND_IN_DOOR_OPEN may last before we offer the
// door-stuck escape hatches (reopen / report issue). 1.5s per poll.
const DOOR_STUCK_POLLS = 8;

/** Route guard: every param present, or a dead link landed here. */
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

/**
 * The locker wizard. Deliberately NO client-side state machine: every render
 * is one switch on the server's simState from the 1.5s status poll. Kill the
 * tab, reopen this URL, and the wizard lands on the correct step.
 *
 * One-tap flow: the courier picks a parcel (on the stop page or here); as
 * soon as the machine binds the QR, the app fires validate+attempt (hand-in)
 * or hand-out/start itself, so the right door opens without typing. The
 * session protocol from the Locker API stays fully intact underneath.
 */
function SessionWizard({ tripId, stopId, sessionId }: { tripId: string; stopId: string; sessionId: string }) {
  const navigate = useNavigate();
  // qrPayload only exists in the create response; passed via router state,
  // optionally with the parcel the courier already picked.
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

  // Re-arm the wizard for a fresh attempt of the SAME parcel: clear the
  // validation verdict, mutation results/errors and the auto-fire guard, so
  // the next READY poll fires validate+attempt again.
  const rearm = () => {
    autoFired.current = null;
    setValidation(null);
    action.reset();
    validate.reset();
  };

  // Full reset of the flow towards a (possibly different) parcel. The ONE
  // place that owns the cleanup ritual — forgetting a piece here is how the
  // "retry fires the stale parcel" class of bug comes back.
  const resetFlow = (next: ParcelView | null = null) => {
    rearm();
    setSelected(next);
    setManualBarcode("");
  };

  // Adopt the parcel picked on the stop page — exactly once. Re-adopting
  // whenever nothing is selected would re-fire the auto-attempt for the
  // first parcel after every "Volgend pakket".
  useEffect(() => {
    if (!adoptedNavParcel.current && navState?.barcode && stop) {
      adoptedNavParcel.current = true;
      setSelected(stop.parcels.find((p) => p.barcode === navState.barcode) ?? null);
    }
  }, [navState?.barcode, stop]);

  // The one-tap heart: machine bound the QR → open the right door ourselves.
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

  // How long the door has been open, counted in status polls.
  const doorIsOpen = simState === "HAND_IN_DOOR_OPEN" || simState === "HAND_OUT_DOOR_OPEN";
  const polledAt = session.dataUpdatedAt;
  useEffect(() => {
    // counting ticks of an external poll is a legitimate setState-in-effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDoorOpenPolls((n) => (doorIsOpen ? n + 1 : 0));
  }, [doorIsOpen, polledAt]);

  const actionError = action.error ?? validate.error;
  // Escalation dead-end: the machine has no free door big enough, not even
  // after size escalation — the parcel cannot be delivered here.
  const cannotDeliver =
    (validation != null && !validation.valid && validation.reason === "NO_CAPACITY") ||
    apiErrorCode(action.error) === "NO_COMPARTMENT_AVAILABLE";
  const openParcels =
    stop?.parcels.filter((p) => p.status === "EXPECTED" || p.status === "NOT_DELIVERED") ?? [];
  // What is still to do, beyond the parcel currently in the doors. The trips
  // query may lag a confirm by a few seconds, so exclude the current barcode.
  const remainingParcels = openParcels.filter((p) => p.barcode !== selected?.barcode);
  const nextParcel = remainingParcels[0] ?? null;

  const finish = () => action.mutate({ action: "finish" });
  const manualScan = () => {
    const parcel = stop?.parcels.find((p) => p.barcode === manualBarcode);
    setValidation(null);
    if (parcel) {
      setSelected(parcel);
    } else {
      // unknown barcode: let the backend judge it as hand-in
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
            hasActionError={actionError != null}
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
            onReportIssue={() =>
              // The defect door goes out of rotation; re-attempting opens the
              // next free door of the same size, or one size up when that
              // size has no free doors left.
              action.mutate({ action: "report-issue" }, { onSuccess: rearm })
            }
            onReportSize={() =>
              // The sim remembers the reported size; re-arming makes the
              // wizard re-attempt at once, so the next bigger free door opens
              // (S → M → … → XXL). When nothing fits anymore the
              // cannot-deliver screen takes over.
              action.mutate({ action: "report-size" }, { onSuccess: rearm })
            }
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
            onReportMissing={() => action.mutate({ action: "report-missing", barcode })}
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
        {actionError != null && (
          <p className="text-dhl-red mt-3 rounded-xl bg-red-50 p-3 text-sm">{apiErrorMessage(actionError)}</p>
        )}
      </QueryGate>
    </CourierLayout>
  );
}
