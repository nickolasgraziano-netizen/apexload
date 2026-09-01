"use client";

import { useState } from "react";
import type { LoggedSet, SetDifficulty } from "@/lib/types";

interface Props {
  set: LoggedSet;
  onUpdate: (id: string, patch: Partial<LoggedSet>) => void;
  onDelete: (id: string) => void;
}

const DIFFICULTIES: SetDifficulty[] = ["easy", "moderate", "difficult", "failed"];

export default function SetRow({ set, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [reps, setReps] = useState(set.actual_reps ?? set.target_reps);
  const [weight, setWeight] = useState(set.weight ?? 0);
  const [difficulty, setDifficulty] = useState<SetDifficulty | null>(set.difficulty);

  function adjustReps(delta: number) {
    setReps((current) => Math.max(1, current + delta));
  }

  function adjustWeight(delta: number) {
    setWeight((current) => Math.max(0, current + delta));
  }

  function save() {
    onUpdate(set.id, { actual_reps: reps, weight, difficulty });
    setEditing(false);
  }

  function renderStepper({
    label,
    value,
    step,
    min,
    onAdjust,
    onChange,
    displayZeroAsEmpty = false,
  }: {
    label: string;
    value: number;
    step: number;
    min: number;
    onAdjust: (delta: number) => void;
    onChange: (value: number) => void;
    displayZeroAsEmpty?: boolean;
  }) {
    return (
      <label className="flex-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-chalk-500">
          {label}
        </span>
        <div className="mt-1 flex items-center gap-2 rounded-lg border border-steel-700 bg-steel-800 p-2">
          <button
            type="button"
            onClick={() => onAdjust(-step)}
            aria-label={`Decrease ${label.toLowerCase()} by ${step}`}
            className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-steel-600 bg-steel-950/40 text-2xl font-semibold leading-none text-chalk-100 active:border-copper-500 active:bg-copper-500 active:text-steel-950"
          >
            -
          </button>
          <input
            type="number"
            min={min}
            step={step}
            inputMode="numeric"
            value={displayZeroAsEmpty && value === 0 ? "" : value}
            onChange={(e) => onChange(e.target.value === "" ? min : Number(e.target.value))}
            onFocus={(e) => e.target.select()}
            className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-center font-display text-3xl font-extrabold text-chalk-100 outline-none"
          />
          <button
            type="button"
            onClick={() => onAdjust(step)}
            aria-label={`Increase ${label.toLowerCase()} by ${step}`}
            className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-steel-600 bg-steel-950/40 text-2xl font-semibold leading-none text-chalk-100 active:border-copper-500 active:bg-copper-500 active:text-steel-950"
          >
            +
          </button>
        </div>
      </label>
    );
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-copper-500 bg-steel-900 p-3">
        <div className="flex gap-3">
          {renderStepper({
            label: "Reps",
            value: reps,
            step: 1,
            min: 1,
            onAdjust: adjustReps,
            onChange: setReps,
          })}
          {renderStepper({
            label: `Weight (${set.weight_unit})`,
            value: weight,
            step: 5,
            min: 0,
            onAdjust: adjustWeight,
            onChange: setWeight,
            displayZeroAsEmpty: true,
          })}
        </div>
        <div className="mt-2 flex gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`rounded-lg px-2 py-1 text-xs capitalize ${
                difficulty === d
                  ? "bg-copper-500 text-steel-950"
                  : "border border-steel-600 text-chalk-300"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={save}
            className="flex-1 rounded-lg bg-copper-500 py-3 text-sm font-semibold text-steel-950"
          >
            Save
          </button>
          <button
            onClick={() => onDelete(set.id)}
            className="apex-secondary-button px-3 py-3 text-sm"
          >
            Delete
          </button>
          <button
            onClick={() => setEditing(false)}
            className="apex-secondary-button px-3 py-3 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex min-h-[58px] w-full items-center justify-between rounded-lg border border-steel-700 bg-steel-900 px-4 py-3 text-left active:border-copper-500"
    >
      <span className="font-mono text-xs text-chalk-500">Set {set.set_number}</span>
      <span className="font-body text-chalk-100">
        {set.actual_reps ?? "—"} reps @ {set.weight ?? "—"} {set.weight_unit}
      </span>
      {set.side && (
        <span className="rounded-md bg-steel-700 px-2 py-0.5 font-mono text-[10px] uppercase text-chalk-300">
          {set.side === "left" ? "L" : "R"}
        </span>
      )}
      {set.training_variant === "tut" && (
        <span className="rounded-md bg-tungsten-600/30 px-2 py-0.5 font-mono text-[10px] uppercase text-tungsten-400">
          TUT
        </span>
      )}
      {set.superset_group_id && (
        <span className="rounded-md bg-copper-600/30 px-2 py-0.5 font-mono text-[10px] uppercase text-copper-400">
          Superset{set.superset_cycle ? ` · R${set.superset_cycle}` : ""}
        </span>
      )}
    </button>
  );
}
