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

  function save() {
    onUpdate(set.id, { actual_reps: reps, weight, difficulty });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-copper-500 bg-steel-900 p-3">
        <div className="flex gap-2">
          <input
            type="number"
            value={reps}
            onChange={(e) => setReps(Number(e.target.value))}
            className="w-16 rounded-lg border border-steel-700 bg-steel-800 px-2 py-2 text-center text-chalk-100"
          />
          <span className="self-center text-chalk-500">reps @</span>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="w-20 rounded-lg border border-steel-700 bg-steel-800 px-2 py-2 text-center text-chalk-100"
          />
          <span className="self-center text-chalk-500">{set.weight_unit}</span>
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
            className="flex-1 rounded-lg bg-copper-500 py-2 text-sm font-semibold text-steel-950"
          >
            Save
          </button>
          <button
            onClick={() => onDelete(set.id)}
            className="rounded-lg border border-steel-600 px-3 py-2 text-sm text-chalk-300"
          >
            Delete
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg border border-steel-600 px-3 py-2 text-sm text-chalk-300"
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
      className="flex w-full items-center justify-between rounded-xl border border-steel-700 bg-steel-900 px-4 py-3 text-left active:border-copper-500"
    >
      <span className="font-mono text-xs text-chalk-500">Set {set.set_number}</span>
      <span className="font-body text-chalk-100">
        {set.actual_reps ?? "—"} reps @ {set.weight ?? "—"} {set.weight_unit}
      </span>
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
