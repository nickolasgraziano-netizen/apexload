"use client";

import { useEffect, useRef, useState } from "react";
import { computeTimerEndTimestamp, playRestCompleteChime, secondsRemaining } from "@/lib/audio";

interface Props {
  defaultSeconds?: number;
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
export default function RestTimer({ defaultSeconds = 90, onDismiss }: Props) {
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
    setEndAt((prev) => Math.max(Date.now(), prev) + delta * 1000);
  }

  const total = Math.max(remaining, 1);
  const pct = Math.min(100, Math.round(((defaultSeconds - remaining) / defaultSeconds) * 100));

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-steel-700 bg-steel-900/95 px-5 pb-6 pt-4 backdrop-blur">
      <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-steel-700">
        <div
          className="h-full bg-tungsten-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-chalk-500">Resting</p>
          <p className="font-display text-4xl font-extrabold tabular-nums text-chalk-100">
            {remaining === 0 ? "Go" : `0:${String(remaining).padStart(2, "0")}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => addSeconds(30)}
            className="rounded-lg border border-steel-600 px-3 py-2 font-mono text-sm text-chalk-300"
          >
            +30s
          </button>
          <button
            onClick={onDismiss}
            className="rounded-lg bg-copper-500 px-4 py-2 font-body text-sm font-semibold text-steel-950"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
