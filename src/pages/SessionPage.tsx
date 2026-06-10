import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { CourierLayout } from "../components/CourierLayout";
import { QueryGate } from "../components/QueryGate";
import { useLockerSession, useSessionAction, useValidate } from "../queries/lockerSession";
import { useTrips } from "../queries/trips";
import { apiErrorMessage } from "../api/client";
import { directionLabel } from "../labels";
import type { ParcelView } from "../api/types";
import type { ValidationResultDto } from "../api/generated";

// How many status polls HAND_IN_DOOR_OPEN may last before we offer the
// door-stuck escape hatches (reopen / report issue). 1.5s per poll.
const DOOR_STUCK_POLLS = 8;

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
export function SessionPage() {
  const { tripId, stopId, sessionId } = useParams();
  const navigate = useNavigate();
  // qrPayload only exists in the create response; passed via router state,
  // optionally with the parcel the courier already picked.
  const navState = useLocation().state as { qrPayload?: string; barcode?: string } | null;
  const qrPayload = navState?.qrPayload;

  const { data: trips } = useTrips();
  const stop = trips?.find((t) => t.id === tripId)?.stops.find((s) => s.id === stopId);
  const session = useLockerSession(sessionId);
  const action = useSessionAction(sessionId!);
  const validate = useValidate(sessionId!);

  const [selected, setSelected] = useState<ParcelView | null>(null);
  const [validation, setValidation] = useState<ValidationResultDto | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const autoFired = useRef<string | null>(null);
  const doorOpenPolls = useRef(0);

  const backTo = `/trips/${tripId}/stops/${stopId}`;
  const simState = session.data?.simState;
  const barcode = selected?.barcode ?? manualBarcode;

  // Adopt the parcel picked on the stop page.
  useEffect(() => {
    if (navState?.barcode && stop && !selected) {
      setSelected(stop.parcels.find((p) => p.barcode === navState.barcode) ?? null);
    }
  }, [navState?.barcode, stop, selected]);

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

  if (simState === "HAND_IN_DOOR_OPEN" || simState === "HAND_OUT_DOOR_OPEN") {
    doorOpenPolls.current += 1;
  } else {
    doorOpenPolls.current = 0;
  }

  const actionError = action.error ?? validate.error;
  const openParcels = stop?.parcels.filter((p) => p.status === "EXPECTED") ?? [];

  return (
    <CourierLayout title="Pakketautomaat" backTo={backTo}>
      <QueryGate isPending={session.isPending} error={session.error}>
        {session.data?.sessionStatus === "EXPIRED" ? (
          <Step title="Sessie verlopen" tone="error">
            <p>De sessie is verlopen. De pakketten volgen de standaard niet-bezorgd afhandeling.</p>
            <PrimaryButton onClick={() => navigate(backTo)}>Terug naar stop</PrimaryButton>
          </Step>
        ) : simState === "CREATED" ? (
          <Step title="Scan de QR-code op de pakketautomaat">
            {selected && (
              <p className="text-center text-sm text-neutral-600">
                {directionLabel[selected.direction]}: <span className="font-mono font-bold">{selected.barcode}</span>
              </p>
            )}
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
          <Step title={selected ? "Bezig met vak openen…" : "Kies een pakket"}>
            {validation && !validation.valid ? (
              <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                {validation.suggestedSize
                  ? `Vak te klein — nieuw voorstel: ${validation.suggestedSize}`
                  : (validation.reason ?? "Barcode niet geldig voor deze sessie")}
                <PrimaryButton
                  busy={validate.isPending || action.isPending}
                  onClick={() => {
                    autoFired.current = null;
                    setValidation(null);
                  }}
                >
                  Opnieuw proberen
                </PrimaryButton>
              </div>
            ) : selected ? (
              <p className="animate-pulse text-center text-neutral-600">
                Vak wordt geopend voor <span className="font-mono font-bold">{selected.barcode}</span>…
              </p>
            ) : (
              <>
                <ul className="flex flex-col gap-2">
                  {openParcels.map((p) => (
                    <li key={p.id}>
                      <button
                        className="flex min-h-12 w-full items-center justify-between rounded-xl border border-neutral-300 bg-white px-4 text-left active:bg-neutral-50"
                        onClick={() => {
                          setValidation(null);
                          setSelected(p);
                        }}
                      >
                        <span className="font-mono font-semibold">{p.barcode}</span>
                        <span className="text-sm text-neutral-600">
                          {directionLabel[p.direction]}
                          {p.size ? ` · ${p.size}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                  {openParcels.length === 0 && <p className="text-neutral-500">Geen open pakketten op deze stop.</p>}
                </ul>
                <button className="text-sm text-neutral-500 underline" onClick={() => setManualOpen((v) => !v)}>
                  Barcode handmatig invoeren
                </button>
                {manualOpen && (
                  <div className="flex gap-2">
                    <input
                      className="min-h-12 grow rounded-xl border border-neutral-300 bg-white px-4 font-mono"
                      placeholder="DHL-…"
                      value={manualBarcode}
                      onChange={(e) => setManualBarcode(e.target.value)}
                    />
                    <PrimaryButton
                      busy={validate.isPending || action.isPending}
                      disabled={!manualBarcode}
                      onClick={() => {
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
                      }}
                    >
                      Scan
                    </PrimaryButton>
                  </div>
                )}
              </>
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
        ) : simState === "HAND_OUT_DOOR_OPEN" ? (
          <Step title="Neem het pakket uit het vak">
            <DoorAnimation />
            {action.data?.compartment?.label && (
              <p className="text-center text-3xl font-bold">Vak {action.data.compartment.label}</p>
            )}
            <p className="text-center text-neutral-600">Neem het pakket eruit en sluit de deur.</p>
            <SecondaryButton
              busy={action.isPending}
              onClick={() => action.mutate({ action: "report-missing", barcode })}
            >
              Pakket ontbreekt
            </SecondaryButton>
            <SecondaryButton busy={action.isPending} onClick={() => action.mutate({ action: "abort" })}>
              Afbreken
            </SecondaryButton>
          </Step>
        ) : simState === "HAND_OUT_AWAITING_CONFIRM" ? (
          <Step title="Deur gesloten">
            <p className="text-neutral-600">Bevestig dat je het pakket hebt meegenomen.</p>
            <PrimaryButton busy={action.isPending} onClick={() => action.mutate({ action: "out-confirm", barcode })}>
              Bevestig ophalen
            </PrimaryButton>
          </Step>
        ) : simState === "HAND_IN_COMPLETED" || simState === "HAND_OUT_COMPLETED" ? (
          <Step title={simState === "HAND_IN_COMPLETED" ? "Pakket ingeleverd ✓" : "Pakket opgehaald ✓"} tone="success">
            <p className="text-neutral-600">De registratie is verwerkt.</p>
            <PrimaryButton
              busy={action.isPending}
              onClick={() => {
                setSelected(null);
                setValidation(null);
                setManualBarcode("");
                autoFired.current = null;
                action.mutate({ action: simState === "HAND_IN_COMPLETED" ? "continue" : "out-continue" });
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
