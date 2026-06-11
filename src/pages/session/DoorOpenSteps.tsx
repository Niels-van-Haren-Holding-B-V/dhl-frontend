import { SecondaryButton } from "../../components/Buttons";
import { ParcelCard } from "../../components/ParcelCard";
import { Step } from "../../components/Step";
import { DoorAnimation } from "./DoorAnimation";
import type { ParcelView } from "../../api/types";

/** HAND_IN_DOOR_OPEN: place the parcel; escalation hatches for stuck/too-small doors. */
export function HandInDoorOpenStep({
  compartmentLabel,
  parcel,
  barcode,
  stuck,
  busy,
  onReopen,
  onReportIssue,
  onReportSize,
}: {
  compartmentLabel: string | undefined;
  parcel: ParcelView | null;
  barcode: string;
  /** The door has been open longer than the stuck threshold — offer escape hatches. */
  stuck: boolean;
  busy: boolean;
  onReopen: () => void;
  onReportIssue: () => void;
  onReportSize: () => void;
}) {
  return (
    <Step title="Plaats pakket en sluit de deur">
      <DoorAnimation />
      {compartmentLabel && <p className="text-center text-3xl font-bold">Vak {compartmentLabel}</p>}
      <ParcelCard parcel={parcel} fallbackBarcode={barcode} />
      <p className="text-center text-neutral-600">
        De deur is open. Plaats dit pakket, sluit de deur — het scherm loopt vanzelf door.
      </p>
      {stuck && (
        <div className="rounded-xl bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">Deur niet gesloten?</p>
          <div className="mt-2 flex gap-2">
            <SecondaryButton busy={busy} onClick={onReopen}>
              Open vak opnieuw
            </SecondaryButton>
            <SecondaryButton busy={busy} onClick={onReportIssue}>
              Meld defect vak
            </SecondaryButton>
          </div>
        </div>
      )}
      <SecondaryButton busy={busy} onClick={onReportSize}>
        Vak te klein
      </SecondaryButton>
    </Step>
  );
}

/** HAND_OUT_DOOR_OPEN: take the parcel out; report-missing and abort hatches. */
export function HandOutDoorOpenStep({
  compartmentLabel,
  parcel,
  barcode,
  busy,
  onReportMissing,
  onAbort,
}: {
  compartmentLabel: string | undefined;
  parcel: ParcelView | null;
  barcode: string;
  busy: boolean;
  onReportMissing: () => void;
  onAbort: () => void;
}) {
  return (
    <Step title="Neem het pakket uit het vak">
      <DoorAnimation />
      {compartmentLabel && <p className="text-center text-3xl font-bold">Vak {compartmentLabel}</p>}
      <ParcelCard parcel={parcel} fallbackBarcode={barcode} />
      <p className="text-center text-neutral-600">Neem dit pakket eruit en sluit de deur.</p>
      <SecondaryButton busy={busy} onClick={onReportMissing}>
        Pakket ontbreekt
      </SecondaryButton>
      <SecondaryButton busy={busy} onClick={onAbort}>
        Afbreken
      </SecondaryButton>
    </Step>
  );
}
