import { PrimaryButton, SecondaryButton } from "../../components/Buttons";
import { ParcelCard } from "../../components/ParcelCard";
import { Step } from "../../components/Step";
import type { ParcelDirection, ParcelView } from "../../api/types";

export function CompletedStep({
  direction,
  nextParcel,
  remainingCount,
  busy,
  onNext,
  onChooseOther,
  onFinish,
}: {
  direction: ParcelDirection;
  nextParcel: ParcelView | null;
  remainingCount: number;
  busy: boolean;
  onNext: () => void;
  onChooseOther: () => void;
  onFinish: () => void;
}) {
  return (
    <Step title={direction === "HAND_IN" ? "Pakket ingeleverd ✓" : "Pakket opgehaald ✓"} tone="success">
      <p className="text-neutral-600">De registratie is verwerkt.</p>
      {nextParcel ? (
        <>
          <p className="text-sm font-semibold text-neutral-700">
            Volgende voor deze stop ({remainingCount} te gaan):
          </p>
          <ParcelCard parcel={nextParcel} fallbackBarcode={nextParcel.barcode} />
          <PrimaryButton busy={busy} onClick={onNext}>
            {nextParcel.direction === "HAND_IN" ? "Volgende inleveren" : "Volgende ophalen"}:{" "}
            {nextParcel.barcode}
          </PrimaryButton>
          <SecondaryButton busy={busy} onClick={onChooseOther}>
            Ander pakket kiezen
          </SecondaryButton>
        </>
      ) : (
        <p className="text-sm text-neutral-600">Alle pakketten voor deze stop zijn afgehandeld.</p>
      )}
      <SecondaryButton busy={busy} onClick={onFinish}>
        Sessie afronden
      </SecondaryButton>
    </Step>
  );
}
