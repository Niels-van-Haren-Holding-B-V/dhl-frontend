import { useSimReset } from "../../queries/simState";
import type { SimStateSnapshot } from "../../api/generated";
import { StateInspector } from "./StateInspector";
import { FailurePanel } from "./FailurePanel";
import { AnnounceParcelPanel } from "./AnnounceParcelPanel";
import { EventLog } from "./EventLog";

/** Operator console: inspector, failure injection, parcel intake, event log. */
export function ConsolePane({ state }: { state: SimStateSnapshot }) {
  const reset = useSimReset();

  return (
    <section className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 shadow">
      <header className="flex items-center justify-between">
        <h2 className="font-bold text-neutral-700">Operator console</h2>
        <button
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold hover:bg-neutral-100"
          onClick={() => reset.mutate()}
          disabled={reset.isPending}
        >
          Reset demo
        </button>
      </header>
      <StateInspector state={state} />
      <FailurePanel state={state} />
      <AnnounceParcelPanel />
      <EventLog state={state} />
    </section>
  );
}
