"use client";

import { useEffect, useRef, useState } from "react";
import {
  computeTimerEndTimestamp,
  playIntervalSwitchChime,
  playRestCompleteChime,
  secondsRemaining,
  vibrateDevice,
} from "@/lib/audio";
import type { IntervalData, IntervalMode } from "@/lib/types";

interface Props {
  lowSeconds: number;
  highSeconds: number;
  mode: IntervalMode;
  targetRounds: number | null;
  targetMinutes: number | null;
  onComplete: (result: IntervalData & { totalElapsedSeconds: number }) => void;
  onCancel: () => void;
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Full-screen so it stays the obvious focus during a cardio interval
 * session — unlike RestTimer's bottom bar, this needs to survive being
 * glanced at from across a gym floor. Auto-completes for "rounds"/"duration"
 * modes; "manual" just keeps cycling until "Stop & save" is tapped.
 */
export default function IntervalTimer({
  lowSeconds,
  highSeconds,
  mode,
  targetRounds,
  targetMinutes,
  onComplete,
  onCancel,
}: Props) {
  const [phase, setPhase] = useState<"low" | "high">("low");
  const [phaseEndAt, setPhaseEndAt] = useState(() => computeTimerEndTimestamp(lowSeconds));
  const [phaseRemaining, setPhaseRemaining] = useState(lowSeconds);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [paused, setPaused] = useState(false);
  const [totalElapsedSeconds, setTotalElapsedSeconds] = useState(0);

  const startedAtRef = useRef(Date.now());
  const pausedAtRef = useRef<number | null>(null);
  const pausedMsRef = useRef(0);
  const advancingRef = useRef(false);
  const completingRef = useRef(false);

  function elapsedNow(): number {
    return Math.max(0, Math.floor((Date.now() - startedAtRef.current - pausedMsRef.current) / 1000));
  }

  function complete(finalRounds: number) {
    if (completingRef.current) return;
    completingRef.current = true;
    playRestCompleteChime();
    vibrateDevice([150, 100, 150, 100, 150]);
    onComplete({
      lowSeconds,
      highSeconds,
      roundsCompleted: finalRounds,
      mode,
      targetRounds,
      targetMinutes,
      totalElapsedSeconds: elapsedNow(),
    });
  }

  useEffect(() => {
    if (paused || completingRef.current) return;
    advancingRef.current = false;
    const interval = setInterval(() => {
      if (completingRef.current) return;

      const elapsed = elapsedNow();
      setTotalElapsedSeconds(elapsed);
      if (mode === "duration" && targetMinutes != null && elapsed >= targetMinutes * 60) {
        complete(roundsCompleted);
        return;
      }

      const left = secondsRemaining(phaseEndAt);
      setPhaseRemaining(left);
      if (left === 0 && !advancingRef.current) {
        advancingRef.current = true;
        if (phase === "low") {
          playIntervalSwitchChime(true);
          vibrateDevice([200]);
          setPhase("high");
          setPhaseEndAt(computeTimerEndTimestamp(highSeconds));
        } else {
          const nextRounds = roundsCompleted + 1;
          setRoundsCompleted(nextRounds);
          if (mode === "rounds" && targetRounds != null && nextRounds >= targetRounds) {
            complete(nextRounds);
            return;
          }
          playIntervalSwitchChime(false);
          vibrateDevice([200, 100, 200]);
          setPhase("low");
          setPhaseEndAt(computeTimerEndTimestamp(lowSeconds));
        }
      }
    }, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, phaseEndAt, paused]);

  function togglePause() {
    if (paused) {
      const pausedDuration = Date.now() - (pausedAtRef.current ?? Date.now());
      pausedMsRef.current += pausedDuration;
      setPhaseEndAt((prev) => prev + pausedDuration);
      pausedAtRef.current = null;
      setPaused(false);
    } else {
      pausedAtRef.current = Date.now();
      setPaused(true);
    }
  }

  const isHigh = phase === "high";
  const roundLabel =
    mode === "rounds" && targetRounds != null
      ? `Round ${roundsCompleted + 1} of ${targetRounds}`
      : `Round ${roundsCompleted + 1}`;

  return (
    <div
      className={`fixed inset-0 z-30 flex flex-col justify-between px-6 pb-8 pt-10 transition-colors duration-500 ${
        isHigh ? "bg-copper-700/95" : "bg-steel-900"
      }`}
    >
      <div>
        <button onClick={onCancel} className="font-mono text-xs uppercase tracking-widest text-chalk-500">
          ✕ Cancel
        </button>
        {mode === "duration" && targetMinutes != null && (
          <p className="mt-4 font-mono text-xs uppercase tracking-widest text-chalk-500">
            Target {targetMinutes} min · {formatClock(totalElapsedSeconds)} elapsed
          </p>
        )}
      </div>

      <div className="flex flex-col items-center">
        <p
          className={`font-mono text-sm uppercase tracking-[0.3em] ${
            isHigh ? "text-steel-950" : "text-tungsten-400"
          }`}
        >
          {isHigh ? "High intensity" : "Low intensity"}
        </p>
        <p
          className={`mt-3 font-display text-7xl font-extrabold tabular-nums ${
            isHigh ? "text-steel-950" : "text-chalk-100"
          }`}
        >
          {paused ? "Paused" : formatClock(phaseRemaining)}
        </p>
        <p className={`mt-4 font-mono text-sm ${isHigh ? "text-steel-950/80" : "text-chalk-500"}`}>
          {roundLabel}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={togglePause}
          className={`flex-1 rounded-xl border py-4 font-semibold ${
            isHigh
              ? "border-steel-950/40 text-steel-950"
              : "border-steel-600 text-chalk-300"
          }`}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={() => complete(roundsCompleted)}
          className={`flex-1 rounded-xl py-4 font-semibold ${
            isHigh ? "bg-steel-950 text-copper-400" : "bg-copper-500 text-steel-950"
          }`}
        >
          Stop & save
        </button>
      </div>
    </div>
  );
}
