import type { CompartmentDto, SimStateSnapshot } from "../../api/generated";
import { Door } from "./Door";
import { ConsoleSlot } from "./ConsoleSlot";

// Door pitch per size in cm — keep mirrored with the template door sizes in
// the backend (LockerConfigurations). Rendering each slot at pitch/machine
// height keeps everything true to scale: an XS is a minor postal parcel,
// never taller than an S. TC/FC modules get a fixed module pitch.
const DOOR_PITCH_CM: Record<string, number> = {
  XXS: 10,
  XS: 15,
  S: 20,
  M: 30,
  L: 40,
  XL: 55,
  XXL: 75,
};
const MODULE_PITCH_CM = 45;

function slotPitch(c: CompartmentDto): number {
  if (c.label === "TC" || c.label === "FC") return MODULE_PITCH_CM;
  return DOOR_PITCH_CM[c.size ?? "M"] ?? 30;
}

/** Schematic front view: the machine as anyone standing in front of it sees it. */
export function MachineFront({ state }: { state: SimStateSnapshot }) {
  const columns = new Map<number, CompartmentDto[]>();
  for (const c of state.compartments ?? []) {
    const col = c.column ?? 0;
    columns.set(col, [...(columns.get(col) ?? []), c]);
  }
  const sorted = [...columns.entries()].sort(([a], [b]) => a - b);
  // Columns differ in total pitch; the machine is as tall as its tallest
  // column and shorter columns get a filler panel at the bottom.
  const machineCm = Math.max(
    ...sorted.map(([, comps]) => comps.reduce((sum, c) => sum + slotPitch(c), 0)),
    1,
  );

  return (
    <section className="flex min-h-0 flex-col">
      <div className="flex min-h-0 grow flex-col rounded-xl border border-neutral-300 bg-neutral-200 p-3 shadow-lg">
        {/* yellow band over the full width */}
        <div className="bg-dhl-yellow mb-3 flex min-h-12 shrink-0 items-center justify-between rounded-md px-4">
          <span className="bg-dhl-red rounded-sm px-2 py-0.5 text-xs font-black tracking-widest text-white">
            PAKKETAUTOMAAT
          </span>
          <span className="text-sm font-bold text-neutral-800">AMS-042 · {state.config}</span>
        </div>
        <OpenDoorBanner state={state} />
        <div className="flex min-h-0 grow items-stretch gap-1">
          {sorted.map(([col, comps]) => (
            // no vertical gaps: slot heights are exact percentages of the column
            <div key={col} className="flex min-w-0 flex-1 flex-col">
              {comps
                .sort((a, b) => (a.nr ?? 0) - (b.nr ?? 0))
                .map((c) => (
                  <Slot key={c.nr} compartment={c} state={state} machineCm={machineCm} />
                ))}
              <div className="grow rounded-b-sm bg-neutral-300/60" aria-hidden />
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-2 h-2 w-3/4 shrink-0 rounded-b-xl bg-neutral-300" aria-hidden />
    </section>
  );
}

/** One column slot: a courier door, the brievenbus, or an embedded module. */
function Slot({
  compartment: c,
  state,
  machineCm,
}: {
  compartment: CompartmentDto;
  state: SimStateSnapshot;
  machineCm: number;
}) {
  const height = `${(slotPitch(c) / machineCm) * 100}%`;
  // The wrapper owns the slot's exact share of the column; the padding is the
  // visible cabinet frame between doors so adjacent doors never blend.
  return (
    <div style={{ height }} className="pt-[3px] first:pt-0">
      {c.label === "TC" ? (
        <ConsoleSlot state={state} />
      ) : c.label === "FC" ? (
        // functional compartment — closed service module, nothing to interact with
        <div className="h-full rounded-sm border border-neutral-400 bg-neutral-500 shadow-inner" />
      ) : c.label === "BUS" ? (
        <div className="flex h-full flex-col items-center justify-center rounded-sm border border-neutral-300 bg-linear-to-b from-neutral-200 to-neutral-400">
          <span className="h-1.5 w-3/5 rounded-full bg-neutral-700" aria-hidden />
          <span className="mt-0.5 text-[8px] font-bold tracking-widest text-neutral-600">BRIEVENBUS</span>
        </div>
      ) : (
        <Door compartment={c} />
      )}
    </div>
  );
}

/** A real machine never opens two doors; nag until the open one is shut. */
function OpenDoorBanner({ state }: { state: SimStateSnapshot }) {
  const open = (state.compartments ?? []).filter((c) => c.state === "DOOR_OPEN");
  if (open.length === 0) return null;
  return (
    <div className="mb-3 flex shrink-0 items-center gap-2 rounded-md border-2 border-amber-400 bg-amber-100 px-4 py-2 font-semibold text-amber-900">
      <span aria-hidden>⚠</span>
      Sluit eerst {open.length === 1 ? "vak" : "vakken"} {open.map((c) => c.label).join(", ")} voordat een
      volgend vak kan openen.
    </div>
  );
}
