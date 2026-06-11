import { useEffect, useRef, useState } from "react";
import type { SimStateSnapshot } from "../../api/generated";
import type { SimSessionDtoStateEnum } from "../../api/generated";

const STRIP: { key: SimSessionDtoStateEnum; label: string }[] = [
  { key: "CREATED", label: "INIT" },
  { key: "READY", label: "GEKOPPELD" },
  { key: "HAND_IN_DOOR_OPEN", label: "DEUR OPEN" },
  { key: "HAND_IN_AWAITING_CONFIRM", label: "BEVESTIGEN" },
  { key: "HAND_IN_COMPLETED", label: "INGELEVERD" },
  { key: "FINISHED", label: "KLAAR" },
];

/** Step strip of the sim's state machine + the optimistic-lock version badge. */
export function StateInspector({ state }: { state: SimStateSnapshot }) {
  const session = state.session;
  const version = session?.version;
  const prev = useRef(version);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (version !== undefined && prev.current !== undefined && version !== prev.current) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 700);
      return () => clearTimeout(t);
    }
  }, [version]);
  useEffect(() => {
    prev.current = version;
  }, [version]);

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold tracking-wide text-neutral-500 uppercase">State machine</h3>
        {session ? (
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-xs font-bold transition-colors ${
              flash ? "bg-dhl-yellow text-black" : "bg-neutral-200 text-neutral-700"
            }`}
          >
            v{session.version}
          </span>
        ) : (
          <span className="text-xs text-neutral-500">geen sessie</span>
        )}
      </div>
      <ol className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
        {STRIP.map((step, i) => {
          const active = session?.state === step.key;
          return (
            <li key={step.key} className="flex items-center gap-1">
              {i > 0 && <span className="text-neutral-400">→</span>}
              <span
                className={`rounded px-1.5 py-0.5 font-bold ${
                  active ? "bg-dhl-red text-white" : "text-neutral-500"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      {session?.state?.startsWith("HAND_OUT") && (
        <p className="mt-1 text-xs text-neutral-500">hand-out: {session.state}</p>
      )}
    </div>
  );
}
