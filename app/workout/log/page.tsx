"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import MuscleGroupSelect from "@/components/MuscleGroupSelect";
import type { Exercise, MuscleGroup, SetDifficulty, SetSide, TrainingVariant } from "@/lib/types";

interface SetEntry {
  reps: number;
  weight: number;
  difficulty: SetDifficulty;
  variant: TrainingVariant;
  side: SetSide | null;
}

interface ExerciseEntry {
  exercise: Exercise;
  sets: SetEntry[];
  cardioDurationMinutes: string;
  cardioNotes: string;
}

const DEFAULT_SET: SetEntry = {
  reps: 10,
  weight: 0,
  difficulty: "moderate",
  variant: "standard",
  side: null,
};

function todayLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export default function LogPastWorkoutPage() {
  const router = useRouter();
  const [date, setDate] = useState(todayLocal());
  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [entries, setEntries] = useState<ExerciseEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<(Exercise & { muscle_groups: { name: string } | null })[]>([]);
  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerGroupId, setPickerGroupId] = useState("");
  const [newName, setNewName] = useState("");
  const [newGroupId, setNewGroupId] = useState("");

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      const { data: mg } = await supabase.from("muscle_groups").select("*").order("name");
      setGroups((mg ?? []) as MuscleGroup[]);
      const { data: ex } = await supabase
        .from("exercises")
        .select("*, muscle_groups ( name )")
        .order("name");
      setCatalog((ex ?? []) as (Exercise & { muscle_groups: { name: string } | null })[]);
    })();
  }, []);

  function addExercise(ex: Exercise) {
    setEntries((prev) =>
      prev.some((e) => e.exercise.id === ex.id)
        ? prev
        : [
            ...prev,
            {
              exercise: ex,
              sets: ex.is_cardio ? [] : [{ ...DEFAULT_SET, side: ex.is_unilateral ? "right" : null }],
              cardioDurationMinutes: "",
              cardioNotes: "",
            },
          ]
    );
    setShowPicker(false);
    setPickerQuery("");
  }

  function updateCardioEntry(exerciseId: string, patch: Partial<Pick<ExerciseEntry, "cardioDurationMinutes" | "cardioNotes">>) {
    setEntries((prev) =>
      prev.map((e) => (e.exercise.id === exerciseId ? { ...e, ...patch } : e))
    );
  }

  async function addCustomExercise() {
    if (!newName.trim() || !newGroupId) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: newExercise } = await supabase
      .from("exercises")
      .insert({ owner_id: user.id, muscle_group_id: newGroupId, name: newName.trim(), is_custom: true })
      .select()
      .single();

    if (newExercise) {
      const groupName = groups.find((g) => g.id === newGroupId)?.name ?? null;
      setCatalog((prev) => [...prev, { ...(newExercise as Exercise), muscle_groups: { name: groupName ?? "" } }]);
      addExercise(newExercise as Exercise);
    }
    setNewName("");
  }

  function removeExercise(exerciseId: string) {
    setEntries((prev) => prev.filter((e) => e.exercise.id !== exerciseId));
  }

  function addSetRow(exerciseId: string) {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.exercise.id !== exerciseId) return e;
        const last = e.sets[e.sets.length - 1] ?? DEFAULT_SET;
        // Alternate sides automatically for unilateral exercises.
        const side = e.exercise.is_unilateral ? (last.side === "right" ? "left" : "right") : null;
        return { ...e, sets: [...e.sets, { ...last, side }] };
      })
    );
  }

  function removeSetRow(exerciseId: string, index: number) {
    setEntries((prev) =>
      prev.map((e) =>
        e.exercise.id === exerciseId ? { ...e, sets: e.sets.filter((_, i) => i !== index) } : e
      )
    );
  }

  function updateSetRow(exerciseId: string, index: number, patch: Partial<SetEntry>) {
    setEntries((prev) =>
      prev.map((e) =>
        e.exercise.id === exerciseId
          ? { ...e, sets: e.sets.map((s, i) => (i === index ? { ...s, ...patch } : s)) }
          : e
      )
    );
  }

  async function saveWorkout() {
    if (entries.length === 0) return;
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const startedAt = new Date(`${date}T12:00:00`);
    const endedAt = new Date(startedAt.getTime() + 45 * 60 * 1000);

    const { data: session } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        muscle_group_id: null,
        name: name.trim() || null,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        notes: notes.trim() || null,
      })
      .select()
      .single();

    if (!session) {
      setSaving(false);
      return;
    }

    let minuteOffset = 0;
    const rows: {
      session_id: string;
      user_id: string;
      exercise_id: string;
      training_variant: TrainingVariant;
      set_number: number;
      target_reps: number;
      actual_reps: number | null;
      weight: number | null;
      difficulty: SetDifficulty | null;
      side: SetSide | null;
      duration_seconds: number | null;
      notes: string | null;
      logged_at: string;
    }[] = [];
    for (const entry of entries) {
      if (entry.exercise.is_cardio) {
        minuteOffset += 1;
        const minutes = Number(entry.cardioDurationMinutes);
        const durationSeconds = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null;
        rows.push({
          session_id: session.id,
          user_id: user.id,
          exercise_id: entry.exercise.id,
          training_variant: "standard",
          set_number: 1,
          target_reps: 0,
          actual_reps: null,
          weight: null,
          difficulty: null,
          side: null,
          duration_seconds: durationSeconds,
          notes: entry.cardioNotes.trim() || null,
          logged_at: new Date(startedAt.getTime() + minuteOffset * 60 * 1000).toISOString(),
        });
        continue;
      }

      entry.sets.forEach((s, i) => {
        minuteOffset += 1;
        rows.push({
          session_id: session.id,
          user_id: user.id,
          exercise_id: entry.exercise.id,
          training_variant: s.variant,
          set_number: i + 1,
          target_reps: s.reps,
          actual_reps: s.reps,
          weight: s.weight,
          difficulty: s.difficulty,
          side: s.side,
          duration_seconds: null,
          notes: null,
          logged_at: new Date(startedAt.getTime() + minuteOffset * 60 * 1000).toISOString(),
        });
      });
    }
    await supabase.from("sets").insert(rows);

    router.push("/history");
  }

  const filteredCatalog = catalog.filter(
    (ex) =>
      ex.name.toLowerCase().includes(pickerQuery.toLowerCase()) &&
      (!pickerGroupId || ex.muscle_group_id === pickerGroupId)
  );

  return (
    <main className="min-h-screen px-5 pb-40 pt-8">
      <p className="font-mono text-xs uppercase tracking-widest text-copper-500">ApexLoad</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-chalk-100">Log a past workout</h1>
      <p className="mt-1 text-sm text-chalk-500">
        For entries from your log book — type in the whole workout at once, no live timer needed.
      </p>

      <label className="mt-5 flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-widest text-chalk-500">
          Name (optional)
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Push Day"
          className="rounded-xl border border-steel-700 bg-steel-900 px-4 py-3 text-chalk-100 outline-none focus:border-copper-500"
        />
      </label>

      <label className="mt-4 flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-widest text-chalk-500">Date</span>
        <input
          type="date"
          value={date}
          max={todayLocal()}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-steel-700 bg-steel-900 px-4 py-3 text-chalk-100 outline-none focus:border-copper-500"
        />
      </label>

      <label className="mt-4 flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-widest text-chalk-500">
          Notes (optional)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How it felt, gym conditions, anything to remember…"
          rows={3}
          className="rounded-xl border border-steel-700 bg-steel-900 px-4 py-3 text-chalk-100 outline-none focus:border-copper-500"
        />
      </label>

      <div className="mt-6 flex flex-col gap-4">
        {entries.map((entry) => (
          <div key={entry.exercise.id} className="rounded-2xl border border-steel-700 bg-steel-900 p-4">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-bold text-chalk-100">{entry.exercise.name}</p>
              <button
                onClick={() => removeExercise(entry.exercise.id)}
                className="font-mono text-xs text-copper-400"
              >
                Remove
              </button>
            </div>
            {entry.exercise.is_cardio ? (
              <div className="mt-3 flex flex-col gap-2">
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-xs text-chalk-500">Duration (minutes)</span>
                  <input
                    type="number"
                    value={entry.cardioDurationMinutes}
                    onChange={(e) =>
                      updateCardioEntry(entry.exercise.id, { cardioDurationMinutes: e.target.value })
                    }
                    className="rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-chalk-100"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-xs text-chalk-500">
                    Notes (intensity, incline, etc.)
                  </span>
                  <textarea
                    value={entry.cardioNotes}
                    onChange={(e) => updateCardioEntry(entry.exercise.id, { cardioNotes: e.target.value })}
                    rows={2}
                    placeholder="e.g. Incline 5, resistance 8"
                    className="rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-sm text-chalk-100"
                  />
                </label>
              </div>
            ) : (
            <div className="mt-3 flex flex-col gap-2">
              {entry.sets.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 font-mono text-xs text-chalk-500">{i + 1}</span>
                  <input
                    type="number"
                    value={s.reps}
                    onChange={(e) => updateSetRow(entry.exercise.id, i, { reps: Number(e.target.value) })}
                    placeholder="Reps"
                    className="w-16 rounded-lg border border-steel-700 bg-steel-800 px-2 py-2 text-center text-chalk-100"
                  />
                  <input
                    type="number"
                    value={s.weight}
                    onChange={(e) => updateSetRow(entry.exercise.id, i, { weight: Number(e.target.value) })}
                    placeholder="lb"
                    className="w-20 rounded-lg border border-steel-700 bg-steel-800 px-2 py-2 text-center text-chalk-100"
                  />
                  <select
                    value={s.difficulty}
                    onChange={(e) =>
                      updateSetRow(entry.exercise.id, i, { difficulty: e.target.value as SetDifficulty })
                    }
                    className="flex-1 rounded-lg border border-steel-700 bg-steel-800 px-2 py-2 text-xs text-chalk-100"
                  >
                    <option value="easy">Easy</option>
                    <option value="moderate">Moderate</option>
                    <option value="difficult">Difficult</option>
                    <option value="failed">Failed</option>
                  </select>
                  <button
                    onClick={() =>
                      updateSetRow(entry.exercise.id, i, {
                        variant: s.variant === "tut" ? "standard" : "tut",
                      })
                    }
                    className={`shrink-0 rounded-lg px-2 py-2 font-mono text-[10px] uppercase ${
                      s.variant === "tut"
                        ? "bg-tungsten-500 text-steel-950"
                        : "border border-steel-600 text-chalk-500"
                    }`}
                  >
                    TUT
                  </button>
                  {entry.exercise.is_unilateral && (
                    <button
                      onClick={() =>
                        updateSetRow(entry.exercise.id, i, {
                          side: s.side === "right" ? "left" : "right",
                        })
                      }
                      className="shrink-0 rounded-lg border border-steel-600 px-2 py-2 font-mono text-[10px] uppercase text-chalk-300"
                    >
                      {s.side === "left" ? "L" : "R"}
                    </button>
                  )}
                  <button
                    onClick={() => removeSetRow(entry.exercise.id, i)}
                    className="shrink-0 font-mono text-xs text-copper-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => addSetRow(entry.exercise.id)}
                className="mt-1 rounded-lg border border-dashed border-steel-600 py-1.5 text-xs text-chalk-300"
              >
                + Add set
              </button>
            </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => setShowPicker(true)}
        className="mt-4 w-full rounded-xl border border-dashed border-steel-600 py-3 text-sm text-chalk-300"
      >
        + Add exercise
      </button>

      {showPicker && (
        <div className="mt-3 rounded-xl border border-steel-700 bg-steel-900 p-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-widest text-chalk-500">Add exercise</p>
            <button onClick={() => setShowPicker(false)} className="text-xs text-chalk-500">
              Close
            </button>
          </div>
          <input
            autoFocus
            placeholder="Search by name…"
            value={pickerQuery}
            onChange={(e) => setPickerQuery(e.target.value)}
            className="mt-2 w-full rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-sm text-chalk-100"
          />
          <select
            value={pickerGroupId}
            onChange={(e) => setPickerGroupId(e.target.value)}
            className="mt-2 w-full rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-sm text-chalk-100"
          >
            <option value="">All muscle groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <ul className="mt-2 flex max-h-60 flex-col gap-1 overflow-y-auto">
            {filteredCatalog.map((ex) => (
              <li key={ex.id}>
                <button
                  onClick={() => addExercise(ex)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-chalk-100 hover:bg-steel-800"
                >
                  <span>{ex.name}</span>
                  <span className="font-mono text-[10px] uppercase text-chalk-500">
                    {ex.muscle_groups?.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 border-t border-steel-700 pt-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-chalk-500">
              Can't find it? Add a custom exercise
            </p>
            <div className="mt-2 flex flex-col gap-2">
              <input
                placeholder="Exercise name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-sm text-chalk-100"
              />
              <MuscleGroupSelect
                groups={groups}
                value={newGroupId}
                onChange={setNewGroupId}
                onGroupCreated={(g) => setGroups((prev) => [...prev, g])}
                userId={userId}
                className="rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-sm text-chalk-100"
              />
              <button
                onClick={addCustomExercise}
                className="rounded-lg bg-copper-500 py-2 text-sm font-semibold text-steel-950"
              >
                Add and use
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={saveWorkout}
        disabled={saving || entries.length === 0}
        className="mt-6 w-full rounded-xl bg-copper-500 px-4 py-4 text-center font-body font-semibold text-steel-950 active:bg-copper-600 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save workout"}
      </button>
    </main>
  );
}
