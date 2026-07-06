"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  averageExerciseDurationMinutes,
  estimateWorkoutDurationMinutes,
} from "@/lib/timeEngine";
import TemplateList from "@/components/TemplateList";
import MuscleGroupSelect from "@/components/MuscleGroupSelect";
import type { Exercise, LoggedSet, MuscleGroup, WorkoutTemplate } from "@/lib/types";

export default function NewWorkoutPage() {
  return (
    <Suspense fallback={null}>
      <NewWorkoutForm />
    </Suspense>
  );
}

// No muscle group chosen yet — let the lifter pick how to start: build a
// fresh workout from a muscle group, relaunch a saved template, or go
// repeat a past day from History. No suggestions, their call.
function WorkoutChooser() {
  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: mg }, { data: tpl }, { data: userRes }] = await Promise.all([
        supabase.from("muscle_groups").select("*").order("name"),
        supabase.from("workout_templates").select("*").order("created_at", { ascending: false }),
        supabase.auth.getUser(),
      ]);
      setGroups((mg ?? []) as MuscleGroup[]);
      setTemplates((tpl ?? []) as WorkoutTemplate[]);
      setUserId(userRes?.user?.id ?? null);
    })();
  }, []);

  return (
    <main className="min-h-screen px-5 pb-24 pt-8">
      <p className="font-mono text-xs uppercase tracking-widest text-copper-500">Set up</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-chalk-100">
        Start a workout
      </h1>

      <section className="mt-6">
        <h2 className="font-mono text-xs uppercase tracking-widest text-chalk-500">
          Build a new workout
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/workout/new?muscleGroupId=${g.id}`}
              className="rounded-xl border border-steel-700 bg-steel-900 px-4 py-3 text-chalk-100"
            >
              {g.name}
            </Link>
          ))}
        </div>
        {groups.length === 0 && <p className="mt-2 text-sm text-chalk-500">Loading…</p>}
      </section>

      {userId && <TemplateList templates={templates} userId={userId} />}

      <section className="mt-6">
        <h2 className="font-mono text-xs uppercase tracking-widest text-chalk-500">
          Or reuse a past workout
        </h2>
        <Link
          href="/history"
          className="mt-2 flex items-center justify-between rounded-xl border border-steel-700 bg-steel-900 px-4 py-3"
        >
          <div>
            <p className="text-chalk-100">Repeat from History</p>
            <p className="mt-0.5 text-xs text-chalk-500">Pick any day you've already done</p>
          </div>
          <span className="font-mono text-xs text-copper-400">→</span>
        </Link>
      </section>
    </main>
  );
}

function NewWorkoutForm() {
  const router = useRouter();
  const params = useSearchParams();
  const muscleGroupId = params.get("muscleGroupId") ?? "";

  const [muscleGroupName, setMuscleGroupName] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [pastSets, setPastSets] = useState<LoggedSet[]>([]);
  const [selected, setSelected] = useState<Exercise[]>([]);
  const [starting, setStarting] = useState(false);

  // Optional supersets, set up before the workout even starts. Stored as
  // plain exercise-id arrays until the session exists to attach them to.
  const [pendingGroups, setPendingGroups] = useState<string[][]>([]);
  const [groupingMode, setGroupingMode] = useState(false);
  const [groupingSelection, setGroupingSelection] = useState<string[]>([]);

  // Insert-from-catalog / add-custom-exercise picker — lets the lifter
  // remove auto-planned exercises and swap in whatever they actually want,
  // not just what's in the current muscle group.
  const [userId, setUserId] = useState<string | null>(null);
  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  const [catalog, setCatalog] = useState<(Exercise & { muscle_groups: { name: string } | null })[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerGroupId, setPickerGroupId] = useState("");
  const [newName, setNewName] = useState("");
  const [newGroupId, setNewGroupId] = useState("");

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

  // Full catalog + all muscle groups, independent of the one this workout
  // was seeded from — the picker lets you pull in exercises from anywhere.
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: mg }, { data: ex }, { data: userRes }] = await Promise.all([
        supabase.from("muscle_groups").select("*").order("name"),
        supabase.from("exercises").select("*, muscle_groups ( name )").order("name"),
        supabase.auth.getUser(),
      ]);
      setGroups((mg ?? []) as MuscleGroup[]);
      setCatalog((ex ?? []) as (Exercise & { muscle_groups: { name: string } | null })[]);
      setUserId(userRes?.user?.id ?? null);
    })();
  }, []);

  const averagesByExerciseId = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const ex of exercises) {
      const setsForExercise = pastSets.filter((s) => s.exercise_id === ex.id);
      map.set(ex.id, averageExerciseDurationMinutes(setsForExercise));
    }
    return map;
  }, [exercises, pastSets]);

  useEffect(() => {
    if (exercises.length === 0) return;

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
  }, [exercises]);

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

  function removeExercise(exerciseId: string) {
    setSelected((prev) => prev.filter((e) => e.id !== exerciseId));
    // Drop it from any superset it was part of; a group that falls below
    // 2 exercises no longer makes sense as a superset.
    setPendingGroups((prev) =>
      prev.map((g) => g.filter((id) => id !== exerciseId)).filter((g) => g.length >= 2)
    );
    setGroupingSelection((prev) => prev.filter((id) => id !== exerciseId));
  }

  function addExerciseToSelected(ex: Exercise) {
    setSelected((prev) => (prev.some((e) => e.id === ex.id) ? prev : [...prev, ex]));
    setShowPicker(false);
    setPickerQuery("");
  }

  async function addCustomExercise() {
    if (!newName.trim() || !newGroupId || !userId) return;
    const supabase = createClient();

    const { data: newExercise } = await supabase
      .from("exercises")
      .insert({ owner_id: userId, muscle_group_id: newGroupId, name: newName.trim(), is_custom: true })
      .select()
      .single();

    if (newExercise) {
      const groupName = groups.find((g) => g.id === newGroupId)?.name ?? null;
      setCatalog((prev) => [
        ...prev,
        { ...(newExercise as Exercise), muscle_groups: { name: groupName ?? "" } },
      ]);
      addExerciseToSelected(newExercise as Exercise);
    }
    setNewName("");
  }

  const filteredCatalog = catalog.filter(
    (ex) =>
      ex.name.toLowerCase().includes(pickerQuery.toLowerCase()) &&
      (!pickerGroupId || ex.muscle_group_id === pickerGroupId)
  );

  if (!muscleGroupId) {
    return <WorkoutChooser />;
  }

  return (
    <main className="min-h-screen px-5 pb-24 pt-8">
      <p className="font-mono text-xs uppercase tracking-widest text-copper-500">Set up</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-chalk-100">
        {muscleGroupName || "Workout"}
      </h1>

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
              <li key={ex.id} className="flex items-center gap-2">
                <button
                  disabled={!groupingMode}
                  onClick={() => toggleGroupingSelection(ex.id)}
                  className={`flex flex-1 items-center justify-between rounded-xl px-4 py-3 text-left text-chalk-100 ${
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
                {!groupingMode && (
                  <button
                    onClick={() => removeExercise(ex.id)}
                    className="shrink-0 rounded-xl border border-copper-600 px-3 py-3 text-copper-400"
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {exercises.length === 0 && (
          <p className="mt-2 text-sm text-chalk-500">Loading catalog…</p>
        )}

        {!groupingMode && (
          <button
            onClick={() => setShowPicker(true)}
            className="mt-2 w-full rounded-xl border border-dashed border-steel-600 py-3 text-sm text-chalk-300"
          >
            + Add exercise
          </button>
        )}

        {showPicker && (
          <div className="mt-3 rounded-xl border border-steel-700 bg-steel-900 p-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs uppercase tracking-widest text-chalk-500">
                Add exercise
              </p>
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
                    onClick={() => addExerciseToSelected(ex)}
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
