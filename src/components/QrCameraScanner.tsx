import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/** Supermarket-scanner beep via WebAudio — no sound asset needed. */
export function scannerBeep() {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = 1200;
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.18);
  osc.onended = () => void ctx.close();
}

/**
 * Live webcam preview that fires onScan exactly once with the first QR code
 * it decodes. Needs a secure context (HTTPS or localhost) for getUserMedia.
 */
export function QrCameraScanner({ onScan }: { onScan: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let raf = 0;
    let active = true;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current!;
        video.srcObject = s;
        void video.play();

        const tick = () => {
          if (!active) return;
          if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height);
            if (code?.data) {
              active = false;
              onScan(code.data);
              return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(() => setError("Camera niet beschikbaar — geef toegang of gebruik het invoerveld"));

    return () => {
      active = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  if (error) {
    return <p className="text-[10px] text-dhl-red">{error}</p>;
  }
  return (
    <div className="relative overflow-hidden rounded">
      <video ref={videoRef} className="h-28 w-full object-cover" muted playsInline />
      {/* viewfinder corners */}
      <div className="pointer-events-none absolute inset-3 rounded border-2 border-dhl-yellow/80 [mask-image:linear-gradient(black,black)]" />
    </div>
  );
}
