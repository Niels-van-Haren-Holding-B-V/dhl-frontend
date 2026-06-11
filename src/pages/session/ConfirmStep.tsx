import { PrimaryButton } from "../../components/Buttons";
import { ParcelCard } from "../../components/ParcelCard";
import { Step } from "../../components/Step";
import type { ParcelDirection, ParcelView } from "../../api/types";

/** HAND_IN/HAND_OUT_AWAITING_CONFIRM: door closed, courier confirms the parcel. */
export function ConfirmStep({
  direction,
  parcel,
  barcode,
  busy,
  onConfirm,
}: {
  direction: ParcelDirection;
  parcel: ParcelView | null;
  barcode: string;
  busy: boolean;
  onConfirm: () => void;
}) {
  return (
    <Step title="Deur gesloten">
      <ParcelCard parcel={parcel} fallbackBarcode={barcode} />
      <p className="text-neutral-600">
        {direction === "HAND_IN"
          ? "Bevestig dat dit pakket in het vak ligt."
          : "Bevestig dat je dit pakket hebt meegenomen."}
      </p>
      <PrimaryButton busy={busy} onClick={onConfirm}>
        {direction === "HAND_IN" ? "Bevestig plaatsing" : "Bevestig ophalen"}
      </PrimaryButton>
    </Step>
  );
}
