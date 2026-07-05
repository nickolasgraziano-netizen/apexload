"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Exercise, MuscleGroup, SetDifficulty } from "@/lib/types";

interface ExtractedSet {
  reps: number;
  weight: number | null;
  difficulty: SetDifficulty | null;
}

interface ReviewEntry {
  extractedName: string;
  matchedExercise: Exercise | null;
  newGroupId: string;
  sets: ExtractedSet[];
}

export default function ImportPhotoPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<"idle" | "analyzing" | "reviewing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  const [saving, setSaving] = useState(false);

  async function handleFile(file: File) {
    setStatus("analyzing");
    setError(null);
    const supabase = createClient();

    const [{ data: mg }, { data: catalog }] = await Promise.all([
      supabase.from("muscle_groups").select("*").order("name"),
      supabase.from("exercises").select("*"),
    ]);
    setGroups((mg ?? []) as MuscleGroup[]);
    const exerciseCatalog = (catalog ?? []) as Exercise[];

    const formData = new FormData();
    formData.append("image", file);

    const res = await fetch("/api/import-photo", { method: "POST", body: formData });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? "Something went wrong reading that photo.");
      setStatus("error");
      return;
    }

    setDate(body.date ?? "");
    setNotes(body.notes || null);
    setEntries(
      (body.entries ?? []).map((e: any) => {
        const match = exerciseCatalog.find(
          (ex) => ex.name.trim().toLowerCase() === String(e.exerciseName).trim().toLowerCase()
        );
        return {
          extractedName: e.exerciseName,
          matchedExercise: match ?? null,
          newGroupId: "",
          sets: (e.sets ?? []).map((s: any) => ({
            reps: s.reps ?? 10,
            weight: s.weight ?? null,
            difficulty: s.difficulty ?? null,
          })),
        };
      })
    );
    setStatus("reviewing");
  }

  function updateEntry(index: number, patch: Partial<ReviewEntry>) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  function removeEntry(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSet(entryIndex: number, setIndex: number, patch: Partial<ExtractedSet>) {
    setEntries((prev) =>
      prev.map((e, i) =>
        i === entryIndex
          ? { ...e, sets: e.sets.map((s, j) => (j === setIndex ? { ...s, ...patch } : s)) }
          : e
      )
    );
  }

  function removeSet(entryIndex: number, setIndex: number) {
    setEntries((prev) =>
      prev.map((e, i) => (i === entryIndex ? { ...e, sets: e.sets.filter((_, j) => j !== setIndex) } : e))
    );
  }

  const canSave =
    entries.length > 0 &&
    entries.every((e) => e.sets.length > 0 && (e.matchedExercise || e.newGroupId));

  async function saveWorkout() {
    if (!canSave) return;
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const startedAt = date ? new Date(`${date}T12:00:00`) : new Date();
    const endedAt = new Date(startedAt.getTime() + 45 * 60 * 1000);

    const { data: session } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        muscle_group_id: null,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
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
      training_variant: "standard";
      set_number: number;
      target_reps: number;
      actual_reps: number;
      weight: number | null;
      difficulty: SetDifficulty | null;
      logged_at: string;
    }[] = [];
    for (const entry of entries) {
      let exerciseId = entry.matchedExercise?.id;
      if (!exerciseId) {
        const { data: newExercise } = await supabase
          .from("exercises")
          .insert({
            owner_id: user.id,
            muscle_group_id: entry.newGroupId,
            name: entry.extractedName,
            is_custom: true,
          })
          .select()
          .single();
        if (!newExercise) continue;
        exerciseId = newExercise.id;
      }
      const finalExerciseId = exerciseId as string;

      entry.sets.forEach((s, i) => {
        minuteOffset += 1;
        rows.push({
          session_id: session.id,
          user_id: user.id,
          exercise_id: finalExerciseId,
          training_variant: "standard" as const,
          set_number: i + 1,
          target_reps: s.reps,
          actual_reps: s.reps,
          weight: s.weight,
          difficulty: s.difficulty,
          logged_at: new Date(startedAt.getTime() + minuteOffset * 60 * 1000).toISOString(),
        });
      });
    }
    if (rows.length > 0) await supabase.from("sets").insert(rows);

    router.push("/history");
  }

  return (
    <main className="min-h-screen px-5 pb-40 pt-8">
      <p className="font-mono text-xs uppercase tracking-widest text-copper-500">ApexLoad</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-chalk-100">Import from a photo</h1>

      {status === "idle" && (
        <>
          <p className="mt-1 text-sm text-chalk-500">
            Take or choose a picture of a log book page. You'll review everything before it's saved.
          </p>
          <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-steel-600 py-12 text-center">
            <span className="font-body text-chalk-100">Choose a photo</span>
            <span className="mt-1 text-xs text-chalk-500">Camera or photo library</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
        </>
      )}

      {status === "analyzing" && (
        <p className="mt-6 text-sm text-chalk-500">Reading the page…</p>
      )}

      {status === "error" && (
        <div className="mt-6 rounded-2xl border border-copper-600 bg-copper-600/10 p-4">
          <p className="text-sm text-copper-400">{error}</p>
          <a href="/workout/log" className="mt-3 inline-block text-sm text-chalk-300 underline">
            Enter this page manually instead
          </a>
        </div>
      )}

      {status === "reviewing" && (
        <>
          {notes && (
            <div className="mt-4 rounded-xl border border-tungsten-500 bg-tungsten-600/10 p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-tungsten-400">
                Worth double-checking
              </p>
              <p className="mt-1 text-sm text-chalk-100">{notes}</p>
            </div>
          )}

          <label className="mt-4 flex flex-col gap-1">
            <span className="font-mono text-xs uppercase tracking-widest text-chalk-500">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-steel-700 bg-steel-900 px-4 py-3 text-chalk-100 outline-none focus:border-copper-500"
            />
          </label>

          <div className="mt-4 flex flex-col gap-4">
            {entries.map((entry, ei) => (
              <div key={ei} className="rounded-2xl border border-steel-700 bg-steel-900 p-4">
                <div className="flex items-center justify-between">
                  {entry.matchedExercise ? (
                    <p className="font-display text-lg font-bold text-chalk-100">
                      {entry.matchedExercise.name}
                    </p>
                  ) : (
                    <input
                      value={entry.extractedName}
                      onChange={(e) => updateEntry(ei, { extractedName: e.target.value })}
                      className="rounded-lg border border-steel-700 bg-steel-800 px-2 py-1 font-display text-lg font-bold text-chalk-100"
                    />
                  )}
                  <button onClick={() => removeEntry(ei)} className="font-mono text-xs text-copper-400">
                    Remove
                  </button>
                </div>
                {!entry.matchedExercise && (
                  <div className="mt-2">
                    <p className="font-mono text-[10px] uppercase text-chalk-500">
                      Not in your catalog — pick a muscle group to add it
                    </p>
                    <select
                      value={entry.newGroupId}
                      onChange={(e) => updateEntry(ei, { newGroupId: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-steel-700 bg-steel-800 px-3 py-2 text-sm text-chalk-100"
                    >
                      <option value="">Muscle group…</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="mt-3 flex flex-col gap-2">
                  {entry.sets.map((s, si) => (
                    <div key={si} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 font-mono text-xs text-chalk-500">{si + 1}</span>
                      <input
                        type="number"
                        value={s.reps}
                        onChange={(e) => updateSet(ei, si, { reps: Number(e.target.value) })}
                        placeholder="Reps"
                        className="w-16 rounded-lg border border-steel-700 bg-steel-800 px-2 py-2 text-center text-chalk-100"
                      />
                      <input
                        type="number"
                        value={s.weight ?? ""}
                        onChange={(e) =>
                          updateSet(ei, si, {
                            weight: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        placeholder="lb"
                        className="w-20 rounded-lg border border-steel-700 bg-steel-800 px-2 py-2 text-center text-chalk-100"
                      />
                      <select
                        value={s.difficulty ?? ""}
                        onChange={(e) =>
                          updateSet(ei, si, {
                            difficulty: (e.target.value || null) as SetDifficulty | null,
                          })
                        }
                        className="flex-1 rounded-lg border border-steel-700 bg-steel-800 px-2 py-2 text-xs text-chalk-100"
                      >
                        <option value="">—</option>
                        <option value="easy">Easy</option>
                        <option value="moderate">Moderate</option>
                        <option value="difficult">Difficult</option>
                        <option value="failed">Failed</option>
                      </select>
                      <button
                        onClick={() => removeSet(ei, si)}
                        className="shrink-0 font-mono text-xs text-copper-400"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={saveWorkout}
            disabled={saving || !canSave}
            className="mt-6 w-full rounded-xl bg-copper-500 px-4 py-4 text-center font-body font-semibold text-steel-950 active:bg-copper-600 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save workout"}
          </button>
        </>
      )}
    </main>
  );
}
