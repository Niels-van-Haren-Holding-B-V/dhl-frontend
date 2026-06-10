import { useEffect, useRef, useState } from "react";
import { useBind, useDoor, useFailureToggle, useSimReset, useSimState } from "../queries/simState";
import { apiErrorMessage } from "../api/client";
import type { CompartmentDto, SimStateSnapshot } from "../api/generated";
import { FailureRequestModeEnum, type SimSessionDtoStateEnum } from "../api/generated";

/**
 * Parcel machine page: landscape kiosk (left) + operator console (right).
 * The machine page authenticates with the same demo courier user and talks
 * only to the backend passthroughs at /api/sim/** — acceptable for a demo;
 * a real machine would have its own identity in the locker realm.
 */
export function MachinePage() {
  const { data, isPending, error } = useSimState();

  return (
    <div className="grid min-h-dvh grid-cols-1 gap-4 bg-neutral-950 p-4 text-neutral-200 lg:grid-cols-[3fr_2fr]">
      {isPending ? (
        <p className="col-span-full self-center text-center text-xl text-neutral-500">Verbinden met automaat…</p>
      ) : error ? (
        <p className="col-span-full self-center text-center text-xl text-dhl-red">{apiErrorMessage(error)}</p>
      ) : (
        <>
          <KioskPane state={data!} />
          <ConsolePane state={data!} />
        </>
      )}
    </div>
  );
}

// ---- left: the machine as the courier sees it ----

function KioskPane({ state }: { state: SimStateSnapshot }) {
  const columns = new Map<number, CompartmentDto[]>();
  for (const c of state.compartments ?? []) {
    const col = c.column ?? 0;
    columns.set(col, [...(columns.get(col) ?? []), c]);
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-neutral-900 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-dhl-yellow">PakketAutomaat AMS-042</h1>
        <span className="text-sm text-neutral-500">{state.config}</span>
      </header>
      <BindBox bound={!!state.session && state.session.state !== "CREATED"} />
      <div className="flex grow items-start justify-center gap-2 overflow-x-auto">
        {[...columns.entries()]
          .sort(([a], [b]) => a - b)
          .map(([col, comps]) => (
            <div key={col} className="flex flex-col gap-2">
              {comps
                .sort((a, b) => (a.nr ?? 0) - (b.nr ?? 0))
                .map((c) => (
                  <Compartment key={c.nr} compartment={c} />
                ))}
            </div>
          ))}
      </div>
    </section>
  );
}

const SIZE_HEIGHT: Record<string, string> = {
  XXS: "h-8",
  XS: "h-10",
  S: "h-12",
  M: "h-16",
  L: "h-20",
  XL: "h-24",
  XXL: "h-28",
};

function Compartment({ compartment: c }: { compartment: CompartmentDto }) {
  const door = useDoor();
  const stateClass =
    c.state === "FREE"
      ? "border-neutral-700 text-neutral-600"
      : c.state === "RESERVED"
        ? "border-dhl-yellow text-dhl-yellow"
        : c.state === "OCCUPIED"
          ? "border-neutral-500 bg-neutral-700 text-neutral-200"
          : c.state === "DOOR_OPEN"
            ? "border-dhl-yellow bg-dhl-yellow/20 animate-pulse text-dhl-yellow"
            : "border-dhl-red text-dhl-red"; // DEFECT

  return (
    <div
      className={`flex w-24 flex-col items-center justify-center rounded-lg border-2 px-1 ${SIZE_HEIGHT[c.size ?? "M"]} ${stateClass}`}
    >
      <span className="text-xs font-bold">
        {c.label} · {c.size}
      </span>
      {c.state === "DEFECT" && <span aria-label="defect">✕</span>}
      {c.state === "OCCUPIED" && c.barcode && <span className="text-[9px]">{c.barcode}</span>}
      {c.state === "DOOR_OPEN" && (
        <div className="mt-0.5 flex gap-1">
          <button
            className="rounded bg-dhl-yellow px-1.5 py-0.5 text-[10px] font-bold text-black"
            onClick={() => door.mutate({ compartmentNr: c.nr!, action: "CLOSE" })}
          >
            Sluit
          </button>
          <button
            className="rounded border border-neutral-500 px-1.5 py-0.5 text-[10px] text-neutral-300"
            onClick={() => door.mutate({ compartmentNr: c.nr!, action: "LEAVE_OPEN" })}
            title="Koerier loopt weg — voer voor de sessie-reaper"
          >
            Laat open
          </button>
        </div>
      )}
    </div>
  );
}

function BindBox({ bound }: { bound: boolean }) {
  const bind = useBind();
  const [qr, setQr] = useState("");
  const [splash, setSplash] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <input
        className="min-h-12 grow rounded-xl border border-neutral-700 bg-neutral-800 px-4 font-mono text-sm"
        placeholder="Scan QR (plak de QR-payload van de koerier)"
        value={qr}
        onChange={(e) => setQr(e.target.value)}
      />
      <button
        className="min-h-12 rounded-xl bg-dhl-yellow px-5 font-bold text-black disabled:opacity-40"
        disabled={!qr || bind.isPending}
        onClick={() =>
          bind.mutate(qr, {
            onSuccess: () => {
              setQr("");
              setSplash(true);
              setTimeout(() => setSplash(false), 2000);
            },
          })
        }
      >
        Scan QR
      </button>
      {splash && <span className="font-bold text-green-400">Gekoppeld ✓</span>}
      {!splash && bound && <span className="text-sm text-neutral-400">sessie actief</span>}
      {bind.error != null && <span className="text-sm text-dhl-red">{apiErrorMessage(bind.error)}</span>}
    </div>
  );
}

// ---- right: operator console ----

function ConsolePane({ state }: { state: SimStateSnapshot }) {
  const reset = useSimReset();

  return (
    <section className="flex flex-col gap-4 overflow-hidden rounded-2xl bg-neutral-900 p-4">
      <header className="flex items-center justify-between">
        <h2 className="font-bold text-neutral-400">Operator console</h2>
        <button
          className="rounded-lg border border-neutral-600 px-3 py-1.5 text-sm hover:bg-neutral-800"
          onClick={() => reset.mutate()}
          disabled={reset.isPending}
        >
          Reset
        </button>
      </header>
      <StateInspector state={state} />
      <FailurePanel state={state} />
      <EventLog state={state} />
    </section>
  );
}

const STRIP: { key: SimSessionDtoStateEnum; label: string }[] = [
  { key: "CREATED", label: "INIT" },
  { key: "READY", label: "GEKOPPELD" },
  { key: "HAND_IN_DOOR_OPEN", label: "DEUR OPEN" },
  { key: "HAND_IN_AWAITING_CONFIRM", label: "BEVESTIGEN" },
  { key: "HAND_IN_COMPLETED", label: "INGELEVERD" },
  { key: "FINISHED", label: "KLAAR" },
];

function StateInspector({ state }: { state: SimStateSnapshot }) {
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
    prev.current = version;
  }, [version]);
  useEffect(() => {
    prev.current = version;
  }, [version]);

  return (
    <div className="rounded-xl bg-neutral-800 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold tracking-wide text-neutral-500 uppercase">State machine</h3>
        {session ? (
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-xs font-bold transition-colors ${
              flash ? "bg-dhl-yellow text-black" : "bg-neutral-700 text-neutral-300"
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
          const isHandOut = session?.state?.startsWith("HAND_OUT");
          return (
            <li key={step.key} className="flex items-center gap-1">
              {i > 0 && <span className="text-neutral-600">→</span>}
              <span
                className={`rounded px-1.5 py-0.5 font-bold ${
                  active ? "bg-dhl-red text-white" : isHandOut ? "text-neutral-600" : "text-neutral-400"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      {state.session?.state?.startsWith("HAND_OUT") && (
        <p className="mt-1 text-xs text-neutral-400">hand-out: {state.session.state}</p>
      )}
    </div>
  );
}

const FAILURE_LABELS: Record<FailureRequestModeEnum, string> = {
  SIZE_TOO_SMALL: "Vak te klein",
  DOOR_STUCK: "Deur klemt",
  COMPARTMENT_DEFECT: "Vak defect",
  PARCEL_MISSING: "Pakket ontbreekt",
  SLOW_NETWORK: "Traag netwerk",
  FORCE_409: "Forceer 409",
};

function FailurePanel({ state }: { state: SimStateSnapshot }) {
  const toggle = useFailureToggle();
  const active = new Set(state.activeFailures ?? []);

  return (
    <div className="rounded-xl bg-neutral-800 p-3">
      <h3 className="text-xs font-bold tracking-wide text-neutral-500 uppercase">Storingen</h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {Object.values(FailureRequestModeEnum).map((mode) => {
          const on = active.has(mode);
          return (
            <button
              key={mode}
              className={`flex min-h-10 items-center justify-between rounded-lg border px-2.5 text-left text-xs font-semibold ${
                on ? "border-amber-400 bg-amber-400/15 text-amber-300" : "border-neutral-600 text-neutral-300"
              }`}
              onClick={() => toggle.mutate({ mode, enabled: !on })}
              disabled={toggle.isPending}
            >
              {FAILURE_LABELS[mode]}
              <span className={`ml-1 rounded-full px-1.5 text-[10px] ${on ? "bg-amber-400 text-black" : "bg-neutral-700"}`}>
                {on ? "AAN" : "uit"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EventLog({ state }: { state: SimStateSnapshot }) {
  const entries = [...(state.eventLog ?? [])].reverse(); // newest on top

  return (
    <div className="flex min-h-0 grow flex-col rounded-xl bg-neutral-800 p-3">
      <h3 className="text-xs font-bold tracking-wide text-neutral-500 uppercase">Event log</h3>
      <ol className="mt-2 grow overflow-y-auto font-mono text-[11px] leading-5">
        {entries.length === 0 && <li className="text-neutral-600">nog geen events</li>}
        {entries.map((e, i) => (
          <li key={`${e.ts}-${i}`} className="flex gap-2 border-b border-neutral-700/50 py-0.5">
            <span className="shrink-0 text-neutral-500">{e.ts?.slice(11, 19)}</span>
            <span className="shrink-0 text-dhl-yellow">{e.endpoint}</span>
            <span className="truncate text-neutral-400">{e.summary}</span>
            <span className="ml-auto shrink-0 text-neutral-500">
              {e.resultingState} v{e.version}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
