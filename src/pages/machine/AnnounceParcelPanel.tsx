import { useState } from "react";
import { useAnnounceParcel } from "../../queries/simState";
import { apiErrorMessage } from "../../api/client";

function randomBarcode() {
  return `DHL-IN-${String(Math.floor(Math.random() * 900) + 100)}`;
}

/**
 * Stand-in for the upstream planning system: announces a parcel via the
 * backend, which publishes it to the parcel-intake topic; the Kafka consumer
 * ingests it and the courier app picks it up on the next trips refresh. The
 * frontend only talks to our backend — Kafka stays server-side.
 */
export function AnnounceParcelPanel() {
  const announce = useAnnounceParcel();
  const [barcode, setBarcode] = useState(randomBarcode);
  const [lengthCm, setLengthCm] = useState(30);
  const [widthCm, setWidthCm] = useState(20);
  const [heightCm, setHeightCm] = useState(10);
  const [weightG, setWeightG] = useState(1000);

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <h3 className="text-xs font-bold tracking-wide text-neutral-500 uppercase">
        Pakket aanmelden (planning → Kafka)
      </h3>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-[10px] font-semibold text-neutral-500">
          Barcode
          <input
            className="w-32 rounded border border-neutral-300 bg-white px-2 py-1 font-mono text-xs"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
          />
        </label>
        {(
          [
            ["L (cm)", lengthCm, setLengthCm],
            ["B (cm)", widthCm, setWidthCm],
            ["H (cm)", heightCm, setHeightCm],
            ["Gewicht (g)", weightG, setWeightG],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="flex flex-col text-[10px] font-semibold text-neutral-500">
            {label}
            <input
              type="number"
              className="w-20 rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
              value={value}
              onChange={(e) => set(Number(e.target.value))}
            />
          </label>
        ))}
        <button
          className="bg-dhl-red min-h-8 rounded-lg px-3 text-xs font-bold text-white disabled:opacity-50"
          disabled={!barcode || announce.isPending}
          onClick={() =>
            announce.mutate(
              { barcode, lengthCm, widthCm, heightCm, weightG },
              { onSuccess: () => setBarcode(randomBarcode()) },
            )
          }
        >
          Aanmelden
        </button>
      </div>
      {announce.isSuccess && (
        <p className="mt-2 text-xs font-semibold text-green-700">
          Aangemeld via Kafka — vak gereserveerd op de automaat, verschijnt zo in de koeriers-app.
        </p>
      )}
      {announce.error != null && (
        <p className="text-dhl-red mt-2 text-xs">{apiErrorMessage(announce.error)}</p>
      )}
    </div>
  );
}
