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

  // Optional supersets, set up before the workout even starts. Stored as
  // plain exercise-id arrays until the session exists to attach them to.
  const [pendingGroups, setPendingGroups] = useState<string[][]>([]);
  const [groupingMode, setGroupingMode] = useState(false);
  const [groupingSelection, setGroupingSelection] = useState<string[]>([]);

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

    for (const exerciseIds of pendingGroups) {
      const { data: group } = await supabase
        .from("superset_groups")
        .insert({ session_id: session.id, user_id: user.id })
        .select()
        .single();
      if (!group) continue;
      await supabase.from("superset_group_exercises").insert(
        exerciseIds.map((exerciseId, position) => ({
          group_id: group.id,
          exercise_id: exerciseId,
          position,
        }))
      );
    }

    router.push(`/workout/${session.id}`);
  }

  function toggleGroupingSelection(exerciseId: string) {
    setGroupingSelection((prev) =>
      prev.includes(exerciseId)
        ? prev.filter((id) => id !== exerciseId)
        : prev.length < 3
          ? [...prev, exerciseId]
          : prev
    );
  }

  function confirmSuperset() {
    if (groupingSelection.length < 2) return;
    setPendingGroups((prev) => [...prev, groupingSelection]);
    setGroupingMode(false);
    setGroupingSelection([]);
  }

  function removePendingGroup(index: number) {
    setPendingGroups((prev) => prev.filter((_, i) => i !== index));
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
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-tungsten-400">~{estimatedMinutes} min</span>
            <button
              onClick={() => {
                setGroupingMode((v) => !v);
                setGroupingSelection([]);
              }}
              className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase ${
                groupingMode
                  ? "bg-tungsten-500 text-steel-950"
                  : "border border-dashed border-steel-600 text-chalk-300"
              }`}
            >
              ⚡ {groupingMode ? "Cancel" : "Superset"}
            </button>
          </div>
        </div>
        <ul className="mt-2 flex flex-col gap-2">
          {selected.map((ex) => {
            const groupIndex = pendingGroups.findIndex((g) => g.includes(ex.id));
            const selectedForGroup = groupingSelection.includes(ex.id);
            return (
              <li key={ex.id}>
                <button
                  disabled={!groupingMode}
                  onClick={() => toggleGroupingSelection(ex.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-chalk-100 ${
                    groupingMode
                      ? selectedForGroup
                        ? "bg-tungsten-500 text-steel-950"
                        : "border border-dashed border-tungsten-500"
                      : "border border-steel-700 bg-steel-900"
                  }`}
                >
                  <span>
                    {groupIndex !== -1 && !groupingMode && "⚡ "}
                    {ex.name}
                  </span>
                  {groupIndex !== -1 && !groupingMode && (
                    <span className="font-mono text-[10px] uppercase text-tungsten-400">
                      Superset {groupIndex + 1}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {exercises.length === 0 && (
          <p className="mt-2 text-sm text-chalk-500">Loading catalog…</p>
        )}

        {groupingMode && (
          <div className="mt-2 flex items-center justify-between rounded-xl border border-tungsten-500 bg-tungsten-600/10 px-4 py-3">
            <p className="text-sm text-tungsten-400">
              {groupingSelection.length < 2
                ? "Pick 2-3 exercises to alternate between"
                : `${groupingSelection.length} selected`}
            </p>
            <button
              onClick={confirmSuperset}
              disabled={groupingSelection.length < 2}
              className="rounded-lg bg-tungsten-500 px-3 py-1.5 text-xs font-semibold text-steel-950 disabled:opacity-40"
            >
              Create superset
            </button>
          </div>
        )}

        {pendingGroups.length > 0 && !groupingMode && (
          <div className="mt-3 flex flex-col gap-1">
            {pendingGroups.map((group, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-chalk-500">
                <span>
                  Superset {i + 1}:{" "}
                  {group
                    .map((id) => selected.find((e) => e.id === id)?.name)
                    .filter(Boolean)
                    .join(" ↔ ")}
                </span>
                <button onClick={() => removePendingGroup(i)} className="text-copper-400">
                  Remove
                </button>
              </div>
            ))}
          </div>
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
