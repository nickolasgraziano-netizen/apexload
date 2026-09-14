"use client";

import { Suspense, useEffect, useState } from "react";
import type { Exercise } from "@/lib/types";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import WorkoutBuilder, { type WorkoutBuilderSaveArgs } from "@/components/WorkoutBuilder";
import { saveWorkoutTemplate } from "@/lib/templates";
import { inferActivityTypeFromExercises } from "@/lib/sessionLifecycle";

// Build a workout and start logging it immediately. Naming it IS saving
// it — it becomes a reusable template right away, and the live session
// launches from that template.
export default function BuildWorkoutPage() {
  return <Suspense fallback={<main className="apex-page"><p role="status">Loading your workout…</p></main>}><BuildWorkoutRoute /></Suspense>;
}

function BuildWorkoutRoute() {
  const params = useSearchParams();
  return <BuildWorkout key={params.toString()} initialParams={{
    muscleGroupId: params.get("muscleGroupId") ?? "",
    name: params.get("name") ?? "",
    reuseLatest: params.get("reuseLatest") === "1" || Boolean(params.get("muscleGroupId")),
  }} />;
}

function BuildWorkout({ initialParams }: { initialParams: { muscleGroupId: string; name: string; reuseLatest: boolean } }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [seed, setSeed] = useState<{ exercises: Exercise[]; groups: string[][] } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    async function loadLatest() {
      const empty = { exercises: [], groups: [] };
      if (!initialParams.reuseLatest || !initialParams.muscleGroupId) {
        setSeed(empty);
        return;
      }
      const db = createClient();
      const { data: { user }, error: authError } = await db.auth.getUser();
      if (authError || !user) throw new Error("Sign in required");
      // Match actual exercises, including custom/template sessions whose group is null.
      const { data: latest, error } = await db.from("sets")
        .select("session_id, exercises!inner(muscle_group_id), sessions!inner(user_id, ended_at, dismissed_at)")
        .eq("sessions.user_id", user.id)
        .not("sessions.ended_at", "is", null)
        .is("sessions.dismissed_at", null)
        .eq("exercises.muscle_group_id", initialParams.muscleGroupId)
        .order("logged_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (!latest) { if (!cancelled) setSeed(empty); return; }
      const [sets, groups] = await Promise.all([
        db.from("sets").select("exercise_id, exercises(*)")
          .eq("session_id", latest.session_id).order("logged_at").order("id"),
        db.from("superset_groups").select("superset_group_exercises(exercise_id, position)")
          .eq("session_id", latest.session_id).eq("user_id", user.id),
      ]);
      if (sets.error || groups.error) throw sets.error || groups.error;
      const exercises: Exercise[] = [];
      for (const row of sets.data ?? []) {
        const exercise = row.exercises as unknown as Exercise | null;
        if (exercise && !exercises.some(e => e.id === exercise.id)) exercises.push(exercise);
      }
      const pendingGroups = (groups.data ?? []).map(group =>
        [...group.superset_group_exercises].sort((a, b) => a.position - b.position)
          .map(e => e.exercise_id).filter(id => exercises.some(e => e.id === id))
      ).filter(group => group.length >= 2);
      if (!cancelled) setSeed({ exercises, groups: pendingGroups });
    }
    loadLatest().catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [initialParams, retry]);

  async function handleSave({ name, selected, pendingGroups }: WorkoutBuilderSaveArgs) {
    setStarting(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setStarting(false);
      return;
    }

    const templateId = await saveWorkoutTemplate(
      supabase,
      user.id,
      name,
      selected.map((e) => e.id),
      pendingGroups
    );
    if (!templateId) {
      setStarting(false);
      return;
    }

    const { data: session } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        muscle_group_id: null,
        template_id: templateId,
        name,
        activity_type: inferActivityTypeFromExercises(selected),
      })
      .select()
      .single();
    if (!session) {
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

  if (loadError) return <main className="apex-page"><p>Your previous workout could not be loaded.</p><button className="apex-chip mt-4" onClick={() => setRetry(value => value + 1)}>Try again</button></main>;
  if (!seed) return <main className="apex-page"><p role="status">Loading your workout…</p></main>;

  return (
    <WorkoutBuilder
      title="Build a workout"
      saving={starting}
      saveLabel="Save & start workout"
      savingLabel="Saving…"
      initialName={initialParams.name}
      subtitle={initialParams.reuseLatest ? (seed.exercises.length ? "Based on your latest workout for this muscle group. Review it, then start fresh." : "No completed workout found for this muscle group yet. Add your first exercises below.") : undefined}
      initialSelected={seed.exercises}
      initialPendingGroups={seed.groups}
      initialPickerGroupId={seed.exercises.length ? "" : initialParams.muscleGroupId}
      onSave={handleSave}
    />
  );
}
