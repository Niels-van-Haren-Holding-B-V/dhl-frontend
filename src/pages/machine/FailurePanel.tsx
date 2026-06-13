import { useFailureToggle } from "../../queries/simState";
import { FailureRequestModeEnum } from "../../api/generated";
import type { SimStateSnapshot } from "../../api/generated";

const FAILURE_LABELS: Record<FailureRequestModeEnum, string> = {
  SIZE_TOO_SMALL: "Vak te klein",
  DOOR_STUCK: "Deur klemt",
  COMPARTMENT_DEFECT: "Vak defect",
  PARCEL_MISSING: "Pakket ontbreekt",
  SLOW_NETWORK: "Traag netwerk",
  FORCE_409: "Forceer 409",
};

export function FailurePanel({ state }: { state: SimStateSnapshot }) {
  const toggle = useFailureToggle();
  const active = new Set(state.activeFailures ?? []);

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <h3 className="text-xs font-bold tracking-wide text-neutral-500 uppercase">Storingen</h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {Object.values(FailureRequestModeEnum).map((mode) => {
          const on = active.has(mode);
          return (
            <button
              key={mode}
              className={`flex min-h-10 items-center justify-between rounded-lg border px-2.5 text-left text-xs font-semibold ${
                on
                  ? "border-amber-400 bg-amber-100 text-amber-900"
                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
              }`}
              onClick={() => toggle.mutate({ mode, enabled: !on })}
              disabled={toggle.isPending}
            >
              {FAILURE_LABELS[mode]}
              <span
                className={`ml-1 rounded-full px-1.5 text-[10px] font-bold ${
                  on ? "bg-amber-400 text-black" : "bg-neutral-200 text-neutral-600"
                }`}
              >
                {on ? "AAN" : "uit"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
