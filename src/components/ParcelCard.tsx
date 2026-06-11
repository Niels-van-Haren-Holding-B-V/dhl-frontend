import { directionLabel } from "../labels";
import type { ParcelView } from "../api/types";

/** Which parcel this step is about: barcode big and scannable-by-eye, plus size/weight. */
export function ParcelCard({
  parcel,
  fallbackBarcode,
}: {
  parcel: ParcelView | null;
  fallbackBarcode: string;
}) {
  const code = parcel?.barcode ?? fallbackBarcode;
  if (!code) return null;
  return (
    <div className="border-dhl-yellow rounded-xl border-2 bg-amber-50 p-3 text-center">
      <p className="font-mono text-2xl font-bold tracking-wider">{code}</p>
      {parcel && (
        <p className="mt-1 text-sm text-neutral-600">
          {directionLabel[parcel.direction]}
          {parcel.size && ` · maat ${parcel.size}`} · {parcel.dimensions.lengthCm}×{parcel.dimensions.widthCm}
          ×{parcel.dimensions.heightCm} cm · {(parcel.dimensions.weightG / 1000).toLocaleString("nl-NL")} kg
        </p>
      )}
    </div>
  );
}
