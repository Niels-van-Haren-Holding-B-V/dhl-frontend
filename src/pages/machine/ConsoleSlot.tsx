import { useCallback, useState } from "react";
import { QrCameraScanner } from "../../components/QrCameraScanner";
import { scannerBeep } from "../../components/scannerBeep";
import { useBind } from "../../queries/simState";
import { apiErrorMessage } from "../../api/client";
import type { SimStateSnapshot } from "../../api/generated";

export function ConsoleSlot({ state }: { state: SimStateSnapshot }) {
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
    <div className="bg-dhl-yellow flex h-full flex-col items-center rounded-sm p-1 shadow-inner">
      <div className="flex min-h-0 w-full grow flex-col gap-1 overflow-y-auto rounded-md border-2 border-neutral-700/80 bg-white p-1.5 shadow-inner">
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
            {bind.error != null && <p className="text-dhl-red text-[10px]">{apiErrorMessage(bind.error)}</p>}
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
              className="bg-dhl-red min-h-9 w-full rounded text-xs font-bold text-white disabled:opacity-40"
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
            {bind.error != null && <p className="text-dhl-red text-[10px]">{apiErrorMessage(bind.error)}</p>}
          </>
        )}
      </div>
    </div>
  );
}
