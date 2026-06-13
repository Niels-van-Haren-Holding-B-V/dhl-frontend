import type { SimStateSnapshot } from "../../api/generated";

export function EventLog({ state }: { state: SimStateSnapshot }) {
  const entries = [...(state.eventLog ?? [])].reverse();

  return (
    <div className="flex min-h-0 grow flex-col rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <h3 className="text-xs font-bold tracking-wide text-neutral-500 uppercase">Event log</h3>
      <ol className="mt-2 grow overflow-y-auto font-mono text-[11px] leading-5">
        {entries.length === 0 && <li className="text-neutral-400">nog geen events</li>}
        {entries.map((e, i) => (
          <li key={`${e.ts}-${i}`} className="flex gap-2 border-b border-neutral-200 py-0.5">
            <span className="shrink-0 text-neutral-400">{e.ts?.slice(11, 19)}</span>
            <span className="text-dhl-red shrink-0 font-semibold">{e.endpoint}</span>
            <span className="truncate text-neutral-600">{e.summary}</span>
            <span className="ml-auto shrink-0 text-neutral-400">
              {e.resultingState} v{e.version}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
