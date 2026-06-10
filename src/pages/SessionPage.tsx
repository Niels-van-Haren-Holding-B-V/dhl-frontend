import { useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { CourierLayout } from "../components/CourierLayout";
import { QueryGate } from "../components/QueryGate";
import { useLockerSession, useSessionAction, useValidate } from "../queries/lockerSession";
import { useTrips } from "../queries/trips";
import { apiErrorMessage } from "../api/client";
import type { ValidationResultDto } from "../api/generated";

// How many status polls HAND_IN_DOOR_OPEN may last before we offer the
// door-stuck escape hatches (reopen / report issue). 1.5s per poll.
const DOOR_STUCK_POLLS = 8;

/**
 * The hand-in wizard. Deliberately NO client-side state machine: every render
 * is one switch on the server's simState from the 1.5s status poll. Kill the
 * tab, reopen this URL, and the wizard lands on the correct step.
 */
export function SessionPage() {
  const { tripId, stopId, sessionId } = useParams();
  const navigate = useNavigate();
  // qrPayload only exists in the create response; passed via router state.
  const qrPayload = (useLocation().state as { qrPayload?: string } | null)?.qrPayload;

  const { data: trips } = useTrips();
  const stop = trips?.find((t) => t.id === tripId)?.stops.find((s) => s.id === stopId);
  const session = useLockerSession(sessionId);
  const action = useSessionAction(sessionId!);
  const validate = useValidate(sessionId!);

  const [barcode, setBarcode] = useState("");
  const [validation, setValidation] = useState<ValidationResultDto | null>(null);
  const doorOpenPolls = useRef(0);

  const backTo = `/trips/${tripId}/stops/${stopId}`;
  const simState = session.data?.simState;

  if (simState === "HAND_IN_DOOR_OPEN") {
    doorOpenPolls.current += 1;
  } else {
    doorOpenPolls.current = 0;
  }

  const actionError = action.error ?? validate.error;

  return (
    <CourierLayout title="Lockersessie" backTo={backTo}>
      <QueryGate isPending={session.isPending} error={session.error}>
        {session.data?.sessionStatus === "EXPIRED" ? (
          <Step title="Sessie verlopen" tone="error">
            <p>De sessie is verlopen. De pakketten volgen de standaard niet-bezorgd afhandeling.</p>
            <PrimaryButton onClick={() => navigate(backTo)}>Terug naar stop</PrimaryButton>
          </Step>
        ) : simState === "CREATED" ? (
          <Step title="Scan de QR-code op de pakketautomaat">
            {qrPayload ? (
              <>
                <div className="flex justify-center rounded-2xl bg-white p-6 shadow">
                  <QRCodeSVG value={qrPayload} size={256} marginSize={2} />
                </div>
                <p className="mt-4 animate-pulse text-center text-neutral-600">Wachten op koppeling…</p>
              </>
            ) : (
              <>
                <p>
                  De QR-code van deze sessie is niet meer beschikbaar (de pagina is opnieuw geladen). Rond de sessie af
                  en start een nieuwe.
                </p>
                <PrimaryButton busy={action.isPending} onClick={() => action.mutate({ action: "finish" })}>
                  Sessie afronden
                </PrimaryButton>
              </>
            )}
          </Step>
        ) : simState === "READY" ? (
          <Step title="Pakket inscannen">
            <p className="text-sm text-neutral-600">
              Verwacht op deze stop:{" "}
              {stop?.parcels
                .filter((p) => p.direction === "HAND_IN" && p.status === "EXPECTED")
                .map((p) => p.barcode)
                .join(", ") || "—"}
            </p>
            <input
              className="mt-3 min-h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 font-mono"
              placeholder="Barcode (bijv. DHL-IN-001)"
              value={barcode}
              onChange={(e) => {
                setBarcode(e.target.value);
                setValidation(null);
              }}
              autoFocus
            />
            {validation && !validation.valid && (
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                {validation.suggestedSize
                  ? `Vak te klein — nieuw voorstel: ${validation.suggestedSize}`
                  : (validation.reason ?? "Barcode niet geldig voor deze sessie")}
              </div>
            )}
            {validation?.valid ? (
              <PrimaryButton
                busy={action.isPending}
                onClick={() => action.mutate({ action: "attempt", barcode }, { onSuccess: () => setValidation(null) })}
              >
                Open vak ({validation.parcelSize})
              </PrimaryButton>
            ) : (
              <PrimaryButton
                busy={validate.isPending}
                disabled={!barcode}
                onClick={() => validate.mutate(barcode, { onSuccess: setValidation })}
              >
                {validation ? "Opnieuw proberen" : "Valideer barcode"}
              </PrimaryButton>
            )}
            <SecondaryButton busy={action.isPending} onClick={() => action.mutate({ action: "finish" })}>
              Sessie afronden
            </SecondaryButton>
          </Step>
        ) : simState === "HAND_IN_DOOR_OPEN" ? (
          <Step title="Plaats pakket en sluit de deur">
            <DoorAnimation />
            {action.data?.compartment?.label && (
              <p className="text-center text-3xl font-bold">Vak {action.data.compartment.label}</p>
            )}
            <p className="text-center text-neutral-600">
              De deur is open. Plaats het pakket, sluit de deur — het scherm loopt vanzelf door.
            </p>
            {doorOpenPolls.current > DOOR_STUCK_POLLS && (
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-900">Deur niet gesloten?</p>
                <div className="mt-2 flex gap-2">
                  <SecondaryButton busy={action.isPending} onClick={() => action.mutate({ action: "reopen" })}>
                    Open vak opnieuw
                  </SecondaryButton>
                  <SecondaryButton busy={action.isPending} onClick={() => action.mutate({ action: "report-issue" })}>
                    Meld defect vak
                  </SecondaryButton>
                </div>
              </div>
            )}
            <SecondaryButton busy={action.isPending} onClick={() => action.mutate({ action: "report-size" })}>
              Vak te klein
            </SecondaryButton>
          </Step>
        ) : simState === "HAND_IN_AWAITING_CONFIRM" ? (
          <Step title="Deur gesloten">
            <p className="text-neutral-600">Bevestig dat het pakket in het vak ligt.</p>
            <PrimaryButton busy={action.isPending} onClick={() => action.mutate({ action: "confirm", barcode })}>
              Bevestig plaatsing
            </PrimaryButton>
          </Step>
        ) : simState === "HAND_IN_COMPLETED" ? (
          <Step title="Pakket ingeleverd ✓" tone="success">
            <p className="text-neutral-600">De bezorging is geregistreerd.</p>
            <PrimaryButton
              busy={action.isPending}
              onClick={() => {
                setBarcode("");
                setValidation(null);
                action.mutate({ action: "continue" });
              }}
            >
              Volgend pakket
            </PrimaryButton>
            <SecondaryButton busy={action.isPending} onClick={() => action.mutate({ action: "finish" })}>
              Sessie afronden
            </SecondaryButton>
          </Step>
        ) : simState === "FINISHED" || session.data?.sessionStatus === "FINISHED" ? (
          <Step title="Sessie afgerond" tone="success">
            <PrimaryButton onClick={() => navigate(backTo)}>Terug naar stop</PrimaryButton>
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
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-dhl-red">{apiErrorMessage(actionError)}</p>
        )}
      </QueryGate>
    </CourierLayout>
  );
}

function Step({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: "success" | "error";
  children: React.ReactNode;
}) {
  const color = tone === "success" ? "text-green-700" : tone === "error" ? "text-dhl-red" : "";
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow">
      <h2 className={`text-lg font-bold ${color}`}>{title}</h2>
      {children}
    </div>
  );
}

function PrimaryButton({
  busy,
  disabled,
  onClick,
  children,
}: {
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className="min-h-12 w-full rounded-xl bg-dhl-red font-semibold text-white disabled:opacity-50"
      disabled={busy || disabled}
      onClick={onClick}
    >
      {busy ? "Bezig…" : children}
    </button>
  );
}

function SecondaryButton({
  busy,
  onClick,
  children,
}: {
  busy?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className="min-h-12 w-full rounded-xl border border-neutral-300 bg-white font-semibold disabled:opacity-50"
      disabled={busy}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function DoorAnimation() {
  return (
    <div className="flex justify-center">
      <div className="relative h-24 w-24 rounded-xl border-4 border-dhl-yellow">
        <div className="absolute inset-y-0 left-0 w-1/2 origin-left animate-pulse rounded-l-lg bg-dhl-yellow/60" />
      </div>
    </div>
  );
}
