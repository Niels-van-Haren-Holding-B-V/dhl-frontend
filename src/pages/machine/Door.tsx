import { useDoor } from "../../queries/simState";
import type { CompartmentDto } from "../../api/generated";

export function Door({ compartment: c }: { compartment: CompartmentDto }) {
  const door = useDoor();

  if (c.state === "DOOR_OPEN") {
    return (
      <div className="relative h-full rounded-sm bg-neutral-400 shadow-inner ring-2 ring-amber-400">
        <div className="absolute inset-y-0 left-0 w-2/5 origin-left -skew-y-6 animate-pulse rounded-sm border border-neutral-400 bg-linear-to-r from-neutral-50 to-neutral-300 shadow-md" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="text-[10px] font-bold text-white drop-shadow">{c.label} open</span>
          <div className="flex flex-wrap justify-center gap-1">
            <button
              className="bg-dhl-yellow rounded px-1.5 py-0.5 text-[10px] font-bold text-black shadow"
              onClick={() => door.mutate({ compartmentNr: c.nr!, action: "CLOSE" })}
            >
              Sluit
            </button>
            <button
              className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700 shadow"
              onClick={() => door.mutate({ compartmentNr: c.nr!, action: "LEAVE_OPEN" })}
              title="Koerier loopt weg — voer voor de sessie-reaper"
            >
              Laat open
            </button>
          </div>
        </div>
      </div>
    );
  }

  const occupied = c.state === "OCCUPIED";
  const stateClass =
    c.state === "RESERVED"
      ? "ring-2 ring-dhl-yellow"
      : c.state === "DEFECT"
        ? "ring-2 ring-dhl-red"
        : occupied
          ? "border-neutral-500 bg-linear-to-b from-neutral-500 to-neutral-600"
          : "bg-linear-to-b from-neutral-100 to-neutral-300";

  return (
    <div
      className={`relative flex h-full flex-col items-center justify-center overflow-hidden rounded-sm border border-neutral-300 shadow-sm ${stateClass}`}
    >
      <span
        className={`absolute top-1/2 right-1 h-3 w-1 -translate-y-1/2 rounded-full ${occupied ? "bg-neutral-300/70" : "bg-neutral-500/60"}`}
        aria-hidden
      />
      <span className={`text-[10px] font-bold ${occupied ? "text-white" : "text-neutral-600"}`}>
        {c.label} · {c.size}
      </span>
      {c.state === "DEFECT" && <span className="text-dhl-red text-sm font-black">✕</span>}
      {occupied && c.barcode && (
        <span className="mt-0.5 rounded bg-white/85 px-1 font-mono text-[8px] font-semibold text-neutral-800">
          {c.barcode}
        </span>
      )}
      {c.state === "RESERVED" && (
        <>
          <span className="text-[9px] font-semibold text-amber-600">gereserveerd</span>
          {c.barcode && (
            <span className="mt-0.5 rounded bg-amber-100 px-1 font-mono text-[8px] font-semibold text-amber-800">
              {c.barcode}
            </span>
          )}
        </>
      )}
    </div>
  );
}
