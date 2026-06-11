import { QRCodeSVG } from "qrcode.react";
import { PrimaryButton } from "../../components/Buttons";
import { Step } from "../../components/Step";
import { directionLabel } from "../../labels";
import type { ParcelView } from "../../api/types";

/** CREATED: show the session QR until the machine binds it. */
export function ScanQrStep({
  qrPayload,
  selected,
  finishBusy,
  onFinish,
}: {
  qrPayload: string | undefined;
  selected: ParcelView | null;
  finishBusy: boolean;
  onFinish: () => void;
}) {
  return (
    <Step title="Scan de QR-code op de pakketautomaat">
      {selected && (
        <p className="text-center text-sm text-neutral-600">
          {directionLabel[selected.direction]}:{" "}
          <span className="font-mono font-bold">{selected.barcode}</span>
        </p>
      )}
      {qrPayload ? (
        <>
          <div className="flex justify-center rounded-2xl bg-white p-6 shadow">
            <QRCodeSVG value={qrPayload} size={256} marginSize={2} />
          </div>
          <p className="mt-4 animate-pulse text-center text-neutral-600">Wachten op koppeling…</p>
        </>
      ) : (
        <>
          <p>
            De QR-code van deze sessie is niet meer beschikbaar (de pagina is opnieuw geladen). Rond de sessie
            af en start een nieuwe.
          </p>
          <PrimaryButton busy={finishBusy} onClick={onFinish}>
            Sessie afronden
          </PrimaryButton>
        </>
      )}
    </Step>
  );
}
