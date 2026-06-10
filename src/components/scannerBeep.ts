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
