"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  averageExerciseDurationMinutes,
  estimateWorkoutDurationMinutes,
  generateTimeConstrainedWorkout,
} from "@/lib/timeEngine";
import type { Exercise, LoggedSet } from "@/lib/types";

export default function NewWorkoutPage() {
  const router = useRouter();
  const params = useSearchParams();
  const muscleGroupId = params.get("muscleGroupId") ?? "";

  const [muscleGroupName, setMuscleGroupName] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [pastSets, setPastSets] = useState<LoggedSet[]>([]);
  const [timeLimit, setTimeLimit] = useState<string>("");
  const [selected, setSelected] = useState<Exercise[]>([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!muscleGroupId) return;
    const supabase = createClient();

    (async () => {
      const { data: mg } = await supabase
        .from("muscle_groups")
        .select("name")
        .eq("id", muscleGroupId)
        .maybeSingle();
      setMuscleGroupName(mg?.name ?? "");

      const { data: ex } = await supabase
        .from("exercises")
        .select("*")
        .eq("muscle_group_id", muscleGroupId);
      setExercises((ex ?? []) as Exercise[]);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && ex && ex.length > 0) {
        const { data: sets } = await supabase
          .from("sets")
          .select("*")
          .eq("user_id", user.id)
          .in(
            "exercise_id",
            ex.map((e) => e.id)
          );
        setPastSets((sets ?? []) as LoggedSet[]);
      }
    })();
  }, [muscleGroupId]);

  const averagesByExerciseId = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const ex of exercises) {
      const setsForExercise = pastSets.filter((s) => s.exercise_id === ex.id);
      map.set(ex.id, averageExerciseDurationMinutes(setsForExercise));
    }
    return map;
  }, [exercises, pastSets]);

  const budgetMinutes = timeLimit ? Number(timeLimit) : null;

  useEffect(() => {
    if (exercises.length === 0) return;

    if (budgetMinutes && budgetMinutes > 0) {
      const candidates = exercises.map((exercise) => ({
        exercise,
        estimatedMinutes: averagesByExerciseId.get(exercise.id) ?? 8,
      }));
      setSelected(generateTimeConstrainedWorkout(candidates, budgetMinutes));
    } else {
      // Default: one exercise per sub-muscle for balanced coverage, baseline 3x15.
      const seenSubMuscles = new Set<string>();
      const defaultList: Exercise[] = [];
      for (const ex of exercises) {
        const key = ex.sub_muscle_id ?? ex.id;
        if (!seenSubMuscles.has(key)) {
          seenSubMuscles.add(key);
          defaultList.push(ex);
        }
      }
      setSelected(defaultList);
    }
  }, [exercises, averagesByExerciseId, budgetMinutes]);

  const estimatedMinutes = useMemo(
    () =>
      Math.round(
        estimateWorkoutDurationMinutes(
          selected.map((e) => e.id),
          averagesByExerciseId
        )
      ),
    [selected, averagesByExerciseId]
  );

  async function startWorkout() {
    setStarting(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        muscle_group_id: muscleGroupId,
        time_budget_minutes: budgetMinutes,
      })
      .select()
      .single();

    if (error || !session) {
      setStarting(false);
      return;
    }

    sessionStorage.setItem(
      `apexload:plan:${session.id}`,
      JSON.stringify(selected.map((e) => e.id))
    );
    router.push(`/workout/${session.id}`);
  }

  return (
    <main className="min-h-screen px-5 pb-24 pt-8">
      <p className="font-mono text-xs uppercase tracking-widest text-copper-500">Set up</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-chalk-100">
        {muscleGroupName || "Workout"}
      </h1>

      <label className="mt-6 flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-widest text-chalk-500">
          Hard time limit (optional)
        </span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="e.g. 45"
          value={timeLimit}
          onChange={(e) => setTimeLimit(e.target.value)}
          className="rounded-xl border border-steel-700 bg-steel-900 px-4 py-3 text-chalk-100 outline-none focus:border-copper-500"
        />
        <span className="mt-1 text-xs text-chalk-500">
          Leave blank for a full balanced session across every sub-muscle.
        </span>
      </label>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-widest text-chalk-500">
            Planned exercises
          </h2>
          <span className="font-mono text-xs text-tungsten-400">~{estimatedMinutes} min</span>
        </div>
        <ul className="mt-2 flex flex-col gap-2">
          {selected.map((ex) => (
            <li
              key={ex.id}
              className="rounded-xl border border-steel-700 bg-steel-900 px-4 py-3 text-chalk-100"
            >
              {ex.name}
            </li>
          ))}
        </ul>
        {exercises.length === 0 && (
          <p className="mt-2 text-sm text-chalk-500">Loading catalog…</p>
        )}
      </section>

      <button
        onClick={startWorkout}
        disabled={starting || selected.length === 0}
        className="mt-8 w-full rounded-xl bg-copper-500 px-4 py-4 text-center font-body font-semibold text-steel-950 active:bg-copper-600 disabled:opacity-50"
      >
        {starting ? "Starting…" : "Start workout"}
      </button>
    </main>
  );
}
