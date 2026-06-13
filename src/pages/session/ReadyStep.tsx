import { useState } from "react";
import { PrimaryButton, SecondaryButton } from "../../components/Buttons";
import { ParcelCard } from "../../components/ParcelCard";
import { Step } from "../../components/Step";
import { directionLabel } from "../../labels";
import type { ParcelView } from "../../api/types";
import type { ValidationResultDto } from "../../api/generated";

export function ReadyStep({
  selected,
  openParcels,
  validation,
  cannotDeliver,
  hasActionError,
  actionBusy,
  validateBusy,
  registerBusy,
  manualBarcode,
  onManualBarcodeChange,
  onPick,
  onManualScan,
  onRegisterNotDelivered,
  onChooseOther,
  onRetry,
  onFinish,
}: {
  selected: ParcelView | null;
  openParcels: ParcelView[];
  validation: ValidationResultDto | null;
  cannotDeliver: boolean;
  hasActionError: boolean;
  actionBusy: boolean;
  validateBusy: boolean;
  registerBusy: boolean;
  manualBarcode: string;
  onManualBarcodeChange: (value: string) => void;
  onPick: (parcel: ParcelView) => void;
  onManualScan: () => void;
  onRegisterNotDelivered: () => void;
  onChooseOther: () => void;
  onRetry: () => void;
  onFinish: () => void;
}) {
  const [manualOpen, setManualOpen] = useState(false);

  return (
    <Step title={selected ? "Bezig met vak openen…" : "Kies een pakket"}>
      {cannotDeliver ? (
        <div className="flex flex-col gap-3 rounded-xl bg-red-50 p-3">
          <p className="text-dhl-red text-sm font-semibold">
            Geen passend vak beschikbaar — ook het grootste vrije vak is te klein. Dit pakket kan niet in deze
            automaat bezorgd worden.
          </p>
          <PrimaryButton busy={registerBusy} onClick={onRegisterNotDelivered}>
            Registreer als niet bezorgd
          </PrimaryButton>
          <SecondaryButton onClick={onChooseOther}>Ander pakket kiezen</SecondaryButton>
        </div>
      ) : validation && !validation.valid ? (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {validation.suggestedSize
            ? `Vak te klein — nieuw voorstel: ${validation.suggestedSize}`
            : (validation.reason ?? "Barcode niet geldig voor deze sessie")}
          <PrimaryButton busy={validateBusy || actionBusy} onClick={onRetry}>
            Opnieuw proberen
          </PrimaryButton>
        </div>
      ) : selected ? (
        <>
          <ParcelCard parcel={selected} fallbackBarcode={selected.barcode} />
          {hasActionError ? (
            <PrimaryButton onClick={onRetry}>Opnieuw proberen</PrimaryButton>
          ) : (
            <p className="animate-pulse text-center text-neutral-600">
              Pak dit pakket — het vak wordt geopend…
            </p>
          )}
        </>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {openParcels.map((p) => (
              <li key={p.id}>
                <button
                  className="flex min-h-12 w-full items-center justify-between rounded-xl border border-neutral-300 bg-white px-4 text-left active:bg-neutral-50"
                  onClick={() => onPick(p)}
                >
                  <span className="font-mono font-semibold">{p.barcode}</span>
                  <span className="text-sm text-neutral-600">
                    {directionLabel[p.direction]}
                    {p.size ? ` · ${p.size}` : ""}
                  </span>
                </button>
              </li>
            ))}
            {openParcels.length === 0 && (
              <p className="text-neutral-500">Geen open pakketten op deze stop.</p>
            )}
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
                onChange={(e) => onManualBarcodeChange(e.target.value)}
              />
              <PrimaryButton
                busy={validateBusy || actionBusy}
                disabled={!manualBarcode}
                onClick={onManualScan}
              >
                Scan
              </PrimaryButton>
            </div>
          )}
        </>
      )}
      <SecondaryButton busy={actionBusy} onClick={onFinish}>
        Sessie afronden
      </SecondaryButton>
    </Step>
  );
}
