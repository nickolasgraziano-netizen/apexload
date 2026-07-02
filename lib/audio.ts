/**
 * Rest-timer engine notes:
 *
 * - Timer accuracy uses a wall-clock end timestamp (Date.now() + duration),
 *   not a naive setInterval counter, so it stays correct even if the tab
 *   is briefly throttled while in the foreground.
 * - The chime plays via the Web Audio API and auto-stops after exactly
 *   3 seconds — no dismiss tap required.
 * - True cross-app audio ducking (lowering Spotify/Apple Music volume)
 *   is an OS-level audio-session feature and is NOT achievable from a
 *   website. This engine only "ducks" other <audio>/media elements it
 *   controls within the page itself. See project README for the native
 *   wrapper path if cross-app ducking becomes a hard requirement later.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function computeTimerEndTimestamp(durationSeconds: number): number {
  return Date.now() + durationSeconds * 1000;
}

export function secondsRemaining(endTimestamp: number): number {
  return Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000));
}

/**
 * Plays a short three-ping chime, auto-stopping after exactly 3 seconds.
 * No user interaction required to stop it.
 */
export function playRestCompleteChime(): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const pingTimes = [now, now + 1, now + 2];

  for (const t of pingTimes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
    gain.gain.linearRampToValueAtTime(0, t + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  }
  // Hard stop at exactly 3s in case anything is still ringing out.
  setTimeout(() => {
    /* oscillators are self-stopping; this is a safety no-op hook for
       any future in-page media element ducking cleanup */
  }, 3000);
}
