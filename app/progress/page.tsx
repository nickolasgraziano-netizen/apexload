import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  computeDifficultyBreakdown,
  computeMuscleGroupFreshness,
  computeSessionsPerWeek,
  computeVariantSplit,
  computeWeeklyVolume,
  isoWeekStart,
} from "@/lib/metrics";
import { buildMotivationalMessage, findLatestPR } from "@/lib/motivation";
import {
  DifficultyChart,
  SessionsPerWeekChart,
  VariantChart,
  VolumeChart,
} from "@/components/charts/MetricsCharts";
import ExerciseProgressExplorer from "@/components/charts/ExerciseProgressExplorer";
import type { Exercise, WorkoutSession } from "@/lib/types";

export default async function ProgressPage() {
  const supabase = createClient();

  const { data: rotation } = await supabase
    .from("user_rotation")
    .select("sort_order, muscle_groups ( id, name )")
    .order("sort_order");
  const muscleGroups = (rotation ?? []).map((r: any) => ({
    id: r.muscle_groups.id,
    name: r.muscle_groups.name,
  }));

  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("id, muscle_group_id, started_at, ended_at")
    .order("started_at");
  const sessions = (sessionRows ?? []) as WorkoutSession[];

  const { data: setRows } = await supabase
    .from("sets")
    .select(
      "weight, actual_reps, difficulty, training_variant, logged_at, exercise_id, exercises ( name ), sessions ( muscle_group_id )"
    );
  const sets = (setRows ?? []) as any[];

  const { data: exerciseRows } = await supabase.from("exercises").select("*").order("name");
  const exercises = (exerciseRows ?? []) as Exercise[];

  const volumeSets = sets
    .filter((s) => s.sessions?.muscle_group_id)
    .map((s) => ({
      weight: s.weight,
      actual_reps: s.actual_reps,
      logged_at: s.logged_at,
      muscle_group_id: s.sessions.muscle_group_id,
    }));

  const weeklyVolume = computeWeeklyVolume(volumeSets);
  const difficultyBreakdown = computeDifficultyBreakdown(sets);
  const variantSplit = computeVariantSplit(sets);
  const freshness = computeMuscleGroupFreshness(
    sessions,
    muscleGroups.map((g) => g.id)
  );
  const sessionsPerWeek = computeSessionsPerWeek(sessions);

  const staleFirst = [...freshness].sort((a, b) => {
    if (a.daysSinceLastTrained == null) return -1;
    if (b.daysSinceLastTrained == null) return 1;
    return b.daysSinceLastTrained - a.daysSinceLastTrained;
  });

  const latestPR = findLatestPR(
    sets
      .filter((s) => s.weight != null && s.exercises?.name)
      .map((s) => ({
        exerciseId: s.exercise_id,
        exerciseName: s.exercises.name,
        weight: s.weight,
        loggedAt: s.logged_at,
      }))
  );
  const currentWeek = isoWeekStart(new Date());
  const sessionsThisWeek = sessionsPerWeek.find((w) => w.weekStart === currentWeek)?.count ?? 0;
  const highlightMessage = buildMotivationalMessage({
    latestPR,
    sessionsThisWeek,
    targetPerWeek: muscleGroups.length || undefined,
    seed: sessions.length,
  });

  return (
    <main className="min-h-screen px-5 pb-24 pt-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-copper-500">ApexLoad</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-chalk-100">Progress</h1>
        </div>
        <Link href="/" className="font-mono text-xs text-chalk-500 underline">
          Home
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p className="mt-6 text-sm text-chalk-500">
          No workouts logged yet — metrics will show up here once you start training.
        </p>
      ) : (
        <>
          <section className="mt-6 rounded-2xl border border-tungsten-500 bg-tungsten-600/10 p-4">
            <p className="font-mono text-xs uppercase tracking-widest text-tungsten-400">
              Highlight
            </p>
            <p className="mt-1 text-chalk-100">{highlightMessage}</p>
          </section>

          <section className="mt-6">
            <h2 className="font-mono text-xs uppercase tracking-widest text-chalk-500">
              Muscle group freshness
            </h2>
            <div className="mt-2 flex flex-col gap-2">
              {staleFirst.map((f) => {
                const name = muscleGroups.find((g) => g.id === f.muscleGroupId)?.name ?? "Unknown";
                const stale = f.daysSinceLastTrained == null || f.daysSinceLastTrained >= 10;
                return (
                  <div
                    key={f.muscleGroupId}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                      stale ? "border-copper-600 bg-copper-600/10" : "border-steel-700 bg-steel-900"
                    }`}
                  >
                    <span className="text-chalk-100">{name}</span>
                    <span
                      className={`font-mono text-xs ${stale ? "text-copper-400" : "text-chalk-500"}`}
                    >
                      {f.daysSinceLastTrained == null
                        ? "Never trained"
                        : f.daysSinceLastTrained === 0
                          ? "Trained today"
                          : `${f.daysSinceLastTrained}d ago`}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-steel-700 bg-steel-900 p-4">
            <h2 className="font-mono text-xs uppercase tracking-widest text-chalk-500">
              Weekly volume by muscle group
            </h2>
            <div className="mt-2">
              <VolumeChart data={weeklyVolume} muscleGroups={muscleGroups} />
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-steel-700 bg-steel-900 p-4">
            <h2 className="font-mono text-xs uppercase tracking-widest text-chalk-500">
              Sessions per week
            </h2>
            <div className="mt-2">
              <SessionsPerWeekChart data={sessionsPerWeek} />
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-steel-700 bg-steel-900 p-4">
            <h2 className="font-mono text-xs uppercase tracking-widest text-chalk-500">
              Effort calibration
            </h2>
            <p className="mt-1 text-xs text-chalk-500">
              How your logged sets are distributed by difficulty — a lot of "easy" sets may mean
              there's room to push harder; a rising "failed" rate flags overreaching.
            </p>
            <div className="mt-2">
              <DifficultyChart data={difficultyBreakdown} />
            </div>
            <h3 className="mt-3 font-mono text-[10px] uppercase tracking-widest text-chalk-500">
              Standard vs. time under tension
            </h3>
            <VariantChart data={variantSplit} />
          </section>

          <section className="mt-6 rounded-2xl border border-steel-700 bg-steel-900 p-4">
            <h2 className="font-mono text-xs uppercase tracking-widest text-chalk-500">
              Exercise progress
            </h2>
            <div className="mt-3">
              <ExerciseProgressExplorer exercises={exercises} />
            </div>
          </section>
        </>
      )}
    </main>
  );
}
