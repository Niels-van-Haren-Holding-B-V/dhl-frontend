import { useCallback, useEffect, useRef, useState } from "react";
import { QrCameraScanner, scannerBeep } from "../components/QrCameraScanner";
import { useBind, useDoor, useFailureToggle, useSimReset, useSimState } from "../queries/simState";
import { apiErrorMessage } from "../api/client";
import type { CompartmentDto, SimStateSnapshot } from "../api/generated";
import { FailureRequestModeEnum, type SimSessionDtoStateEnum } from "../api/generated";

/**
 * Parcel machine page: schematic front view of a DHL-style locker (yellow
 * band, light grey doors, console column in the middle) + operator console.
 * The page authenticates with the same demo courier user and talks only to
 * the backend passthroughs at /api/sim/** — acceptable for a demo; a real
 * machine would have its own identity in the locker realm.
 */
export function MachinePage() {
  const { data, isPending, error } = useSimState();

  return (
    <div className="grid min-h-dvh grid-cols-1 gap-4 bg-neutral-100 p-4 text-neutral-900 lg:grid-cols-[3fr_2fr]">
      {isPending ? (
        <p className="col-span-full self-center text-center text-xl text-neutral-500">Verbinden met automaat…</p>
      ) : error ? (
        <p className="col-span-full self-center text-center text-xl text-dhl-red">{apiErrorMessage(error)}</p>
      ) : (
        <>
          <MachineFront state={data!} />
          <ConsolePane state={data!} />
        </>
      )}
    </div>
  );
}

// ---- left: schematic front view of the machine ----

function MachineFront({ state }: { state: SimStateSnapshot }) {
  const columns = new Map<number, CompartmentDto[]>();
  for (const c of state.compartments ?? []) {
    const col = c.column ?? 0;
    columns.set(col, [...(columns.get(col) ?? []), c]);
  }
  const sorted = [...columns.entries()].sort(([a], [b]) => a - b);
  // The console column sits in the middle of the machine, like the real one.
  const consoleAt = Math.floor(sorted.length / 2);

  return (
    <section className="flex flex-col items-center justify-center">
      <div className="overflow-x-auto rounded-xl border border-neutral-300 bg-neutral-200 p-3 shadow-lg">
        {/* yellow band over the full width */}
        <div className="mb-3 flex min-h-12 items-center justify-between rounded-md bg-dhl-yellow px-4">
          <span className="rounded-sm bg-dhl-red px-2 py-0.5 text-xs font-black tracking-widest text-white">
            PAKKETAUTOMAAT
          </span>
          <span className="text-sm font-bold text-neutral-800">AMS-042 · {state.config}</span>
        </div>
        <div className="flex items-stretch gap-2">
          {sorted.map(([col, comps], i) => (
            <>
              {i === consoleAt && <ConsoleColumn key="console" state={state} />}
              <div key={col} className="flex w-24 flex-col gap-1.5">
                {comps
                  .sort((a, b) => (a.nr ?? 0) - (b.nr ?? 0))
                  .map((c) => (
                    <Door key={c.nr} compartment={c} />
                  ))}
              </div>
            </>
          ))}
        </div>
      </div>
      <div className="mt-2 h-2 w-3/4 rounded-b-xl bg-neutral-300" aria-hidden />
    </section>
  );
}

const SIZE_HEIGHT: Record<string, string> = {
  XXS: "h-9",
  XS: "h-11",
  S: "h-14",
  M: "h-20",
  L: "h-24",
  XL: "h-28",
  XXL: "h-32",
};

function Door({ compartment: c }: { compartment: CompartmentDto }) {
  const door = useDoor();
  const height = SIZE_HEIGHT[c.size ?? "M"];

  if (c.state === "DOOR_OPEN") {
    // open door: dark-ish cavity + door panel swung out to the left
    return (
      <div className={`relative ${height} rounded-sm bg-neutral-400 shadow-inner ring-2 ring-amber-400`}>
        <div className="absolute inset-y-0 left-0 w-2/5 origin-left -skew-y-6 animate-pulse rounded-sm border border-neutral-400 bg-linear-to-r from-neutral-50 to-neutral-300 shadow-md" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="text-[10px] font-bold text-white drop-shadow">{c.label} open</span>
          <div className="flex gap-1">
            <button
              className="rounded bg-dhl-yellow px-1.5 py-0.5 text-[10px] font-bold text-black shadow"
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

  const stateClass =
    c.state === "RESERVED"
      ? "ring-2 ring-dhl-yellow"
      : c.state === "DEFECT"
        ? "ring-2 ring-dhl-red"
        : c.state === "OCCUPIED"
          ? "bg-linear-to-b from-neutral-300 to-neutral-400"
          : "";

  return (
    <div
      className={`relative flex ${height} flex-col items-center justify-center rounded-sm border border-neutral-300 bg-linear-to-b from-neutral-100 to-neutral-300 shadow-sm ${stateClass}`}
    >
      {/* handle */}
      <span className="absolute top-1/2 right-1 h-3 w-1 -translate-y-1/2 rounded-full bg-neutral-500/60" aria-hidden />
      <span className="text-[10px] font-bold text-neutral-600">
        {c.label} · {c.size}
      </span>
      {c.state === "DEFECT" && <span className="text-sm font-black text-dhl-red">✕</span>}
      {c.state === "OCCUPIED" && c.barcode && (
        <span className="font-mono text-[8px] text-neutral-600">{c.barcode}</span>
      )}
      {c.state === "RESERVED" && <span className="text-[9px] font-semibold text-amber-600">gereserveerd</span>}
    </div>
  );
}

function ConsoleColumn({ state }: { state: SimStateSnapshot }) {
  const bind = useBind();
  const [qr, setQr] = useState("");
  const [camera, setCamera] = useState(true);
  const [splash, setSplash] = useState(false);
  const session = state.session;
  const bound = !!session && session.state !== "CREATED" && session.state !== "FINISHED";

  const doBind = useCallback(
    (code: string) => {
      bind.mutate(code, {
        onSuccess: () => {
          setQr("");
          setSplash(true);
          setTimeout(() => setSplash(false), 2000);
        },
      });
    },
    [bind],
  );

  const onCameraScan = useCallback(
    (code: string) => {
      scannerBeep();
      doBind(code);
    },
    [doBind],
  );

  return (
    <div className="flex w-44 shrink-0 flex-col items-center gap-2 rounded-sm bg-dhl-yellow p-2 shadow-inner">
      {/* the screen */}
      <div className="flex w-full grow flex-col gap-2 rounded-md border-4 border-neutral-700/80 bg-white p-2 shadow-inner">
        <p className="text-center text-[11px] font-bold text-neutral-700">24/7 Pakketautomaat</p>
        {splash ? (
          <p className="my-auto text-center text-lg font-black text-green-600">Gekoppeld ✓</p>
        ) : bound ? (
          <p className="my-auto text-center text-sm font-semibold text-neutral-700">
            Sessie actief
            <span className="mt-1 block font-mono text-[10px] text-neutral-500">{session?.state}</span>
          </p>
        ) : camera ? (
          <>
            <p className="text-[10px] font-semibold text-neutral-600">Houd de QR-code voor de camera</p>
            {bind.isPending ? (
              <p className="my-4 text-center text-xs text-neutral-500">Verbinden…</p>
            ) : (
              <QrCameraScanner onScan={onCameraScan} />
            )}
            <button className="text-[10px] text-neutral-500 underline" onClick={() => setCamera(false)}>
              Handmatig invoeren
            </button>
            {bind.error != null && <p className="text-[10px] text-dhl-red">{apiErrorMessage(bind.error)}</p>}
          </>
        ) : (
          <>
            <label className="text-[10px] font-semibold text-neutral-600" htmlFor="qr-input">
              Scan QR-code van de koerier
            </label>
            <input
              id="qr-input"
              className="w-full rounded border border-neutral-300 px-2 py-1.5 font-mono text-[10px]"
              placeholder="DHL-LOCKER:…"
              value={qr}
              onChange={(e) => setQr(e.target.value)}
            />
            <button
              className="min-h-9 w-full rounded bg-dhl-red text-xs font-bold text-white disabled:opacity-40"
              disabled={!qr || bind.isPending}
              onClick={() => {
                scannerBeep();
                doBind(qr);
              }}
            >
              Scan QR
            </button>
            <button className="text-[10px] text-neutral-500 underline" onClick={() => setCamera(true)}>
              Camera gebruiken
            </button>
            {bind.error != null && <p className="text-[10px] text-dhl-red">{apiErrorMessage(bind.error)}</p>}
          </>
        )}
      </div>
      {/* parcel chute below the screen */}
      <div className="h-10 w-full rounded-sm bg-neutral-600/80 shadow-inner" aria-hidden />
    </div>
  );
}

// ---- right: operator console ----

function ConsolePane({ state }: { state: SimStateSnapshot }) {
  const reset = useSimReset();

  return (
    <section className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow">
      <header className="flex items-center justify-between">
        <h2 className="font-bold text-neutral-700">Operator console</h2>
        <button
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold hover:bg-neutral-100"
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

function EventLog({ state }: { state: SimStateSnapshot }) {
  const entries = [...(state.eventLog ?? [])].reverse(); // newest on top

  return (
    <div className="flex min-h-0 grow flex-col rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <h3 className="text-xs font-bold tracking-wide text-neutral-500 uppercase">Event log</h3>
      <ol className="mt-2 grow overflow-y-auto font-mono text-[11px] leading-5">
        {entries.length === 0 && <li className="text-neutral-400">nog geen events</li>}
        {entries.map((e, i) => (
          <li key={`${e.ts}-${i}`} className="flex gap-2 border-b border-neutral-200 py-0.5">
            <span className="shrink-0 text-neutral-400">{e.ts?.slice(11, 19)}</span>
            <span className="shrink-0 font-semibold text-dhl-red">{e.endpoint}</span>
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
