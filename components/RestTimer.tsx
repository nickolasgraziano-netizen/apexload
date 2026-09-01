"use client";

import { useEffect, useRef, useState } from "react";
import { computeTimerEndTimestamp, playRestCompleteChime, secondsRemaining } from "@/lib/audio";

interface Props {
  defaultSeconds?: number;
  message?: string;
  hidden?: boolean;
  onTick?: (snapshot: { remaining: number; pct: number }) => void;
  onDismiss: () => void;
}

/**
 * Auto-starts the moment it mounts (i.e. the moment a set is logged).
 * Ticks off a wall-clock end timestamp so it stays accurate even if the
 * render loop stutters. Plays a self-stopping 3s chime at zero — no tap
 * required to silence it, keeping the lifter hands-free.
 *
 * Foreground-only by design: reliable audio when the screen is locked or
 * the tab is backgrounded isn't achievable from the web platform, so this
 * assumes the phone stays unlocked and the app stays in view during a set.
 */
export default function RestTimer({ defaultSeconds = 30, message, hidden = false, onTick, onDismiss }: Props) {
  const [endAt, setEndAt] = useState(() => computeTimerEndTimestamp(defaultSeconds));
  const [remaining, setRemaining] = useState(defaultSeconds);
  const chimedRef = useRef(false);

  useEffect(() => {
    chimedRef.current = false;
    const interval = setInterval(() => {
      const left = secondsRemaining(endAt);
      setRemaining(left);
      if (left === 0 && !chimedRef.current) {
        chimedRef.current = true;
        playRestCompleteChime();
      }
    }, 250);
    return () => clearInterval(interval);
  }, [endAt]);

  function addSeconds(delta: number) {
    setEndAt((prev) => {
      const next = Math.max(Date.now(), prev) + delta * 1000;
      // Update the displayed number immediately rather than waiting for the
      // next 250ms tick — otherwise a tap can look like it did nothing (or
      // did the opposite) for a moment right after you press it.
      setRemaining(secondsRemaining(next));
      return next;
    });
  }

  const pct = Math.min(100, Math.round(((defaultSeconds - remaining) / defaultSeconds) * 100));

  useEffect(() => {
    onTick?.({ remaining, pct });
  }, [onTick, pct, remaining]);

  if (hidden) return null;

  return (
    <div className="apex-rest-timer fixed inset-x-0 bottom-[4.5rem] z-50 border-t border-steel-700/70 bg-steel-900/95 shadow-2xl shadow-steel-950/70 backdrop-blur-lg">
      <div className="apex-rest-timer-inner mx-auto max-w-md px-5 pb-3 pt-3">
      <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-steel-700">
        <div
          className="h-full bg-tungsten-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="apex-rest-timer-main flex items-baseline gap-3">
            <p className="font-mono text-xs uppercase tracking-widest text-chalk-500">Resting</p>
            <p className="font-display text-4xl font-extrabold leading-none tabular-nums text-chalk-100">
              {remaining === 0 ? "Go" : `0:${String(remaining).padStart(2, "0")}`}
            </p>
          </div>
          {message && (
            <p className="apex-rest-timer-message mt-1 truncate text-sm leading-5 text-tungsten-400">
              {message}
            </p>
          )}
        </div>
        <div className="apex-rest-timer-actions grid shrink-0 grid-cols-3 gap-2">
          <button
            onClick={() => addSeconds(-15)}
            className="min-w-16 rounded-lg border border-steel-600 px-3 py-2.5 font-mono text-sm text-chalk-300"
            aria-label="Subtract 15 seconds"
          >
            -15s
          </button>
          <button
            onClick={() => addSeconds(15)}
            className="min-w-16 rounded-lg border border-steel-600 px-3 py-2.5 font-mono text-sm text-chalk-300"
            aria-label="Add 15 seconds"
          >
            +15s
          </button>
          <button
            onClick={onDismiss}
            className="min-w-16 rounded-lg bg-copper-500 px-3 py-2 font-body text-sm font-semibold text-steel-950"
          >
            Skip
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
