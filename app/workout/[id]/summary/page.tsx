import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeDifficultyBreakdown,
  computeDurationMinutes,
  computeSessionSummary,
} from "@/lib/metrics";
import { DifficultyChart } from "@/components/charts/MetricsCharts";

export default async function WorkoutSummaryPage({ params }: { params: { id: string } }) {
  const sessionId = params.id;
  const supabase = createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, name, started_at, ended_at, muscle_groups ( name ), workout_templates ( name )")
    .eq("id", sessionId)
    .single();

  if (!session) redirect("/");
  if (!session.ended_at) redirect(`/workout/${sessionId}`);

  const { data: setRows } = await supabase
    .from("sets")
    .select(
      "exercise_id, weight, actual_reps, difficulty, duration_seconds, exercises ( name, is_cardio )"
    )
    .eq("session_id", sessionId);
  const sets = (setRows ?? []) as any[];

  const exerciseIds = Array.from(new Set(sets.map((s) => s.exercise_id as string)));
  const exerciseInfo = new Map(
    sets.map((s) => [s.exercise_id as string, { name: s.exercises?.name ?? "Unknown exercise", isCardio: !!s.exercises?.is_cardio }])
  );

  const priorMaxWeightByExercise = new Map<string, number>();
  if (exerciseIds.length > 0) {
    const { data: priorSets } = await supabase
      .from("sets")
      .select("exercise_id, weight")
      .in("exercise_id", exerciseIds)
      .neq("session_id", sessionId)
      .not("weight", "is", null);
    for (const s of priorSets ?? []) {
      const current = priorMaxWeightByExercise.get(s.exercise_id as string) ?? 0;
      if ((s.weight as number) > current) priorMaxWeightByExercise.set(s.exercise_id as string, s.weight as number);
    }
  }

  const summary = computeSessionSummary(sets, exerciseInfo, priorMaxWeightByExercise);
  const difficultyBreakdown = computeDifficultyBreakdown(sets);
  const durationMinutes = computeDurationMinutes(session.started_at, session.ended_at);
  const workoutName =
    session.name || (session as any).muscle_groups?.name || (session as any).workout_templates?.name || "Workout";

  return (
    <main className="min-h-screen px-5 pb-24 pt-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-copper-500">ApexLoad</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold text-chalk-100">Workout complete</h1>
        <p className="mt-1 text-sm text-chalk-500">{workoutName}</p>
      </div>

      {summary.prCount > 0 && (
        <section className="mt-6 rounded-2xl border border-tungsten-500 bg-tungsten-600/10 p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-tungsten-400">
            {summary.prCount === 1 ? "New PR" : `${summary.prCount} new PRs`}
          </p>
          <p className="mt-1 text-chalk-100">
            {summary.exercises
              .filter((e) => e.isPR)
              .map((e) => `${e.exerciseName} at ${e.topWeight} lb`)
              .join(" · ")}
          </p>
        </section>
      )}

      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-steel-700 bg-steel-900 p-3 text-center">
          <p className="font-display text-2xl font-extrabold text-chalk-100">{durationMinutes}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-chalk-500">Minutes</p>
        </div>
        <div className="rounded-xl border border-steel-700 bg-steel-900 p-3 text-center">
          <p className="font-display text-2xl font-extrabold text-chalk-100">{summary.totalSets}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-chalk-500">Sets</p>
        </div>
        <div className="rounded-xl border border-steel-700 bg-steel-900 p-3 text-center">
          <p className="font-display text-2xl font-extrabold text-chalk-100">
            {summary.totalVolume.toLocaleString()}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-chalk-500">
            Volume (lb)
          </p>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="font-mono text-xs uppercase tracking-widest text-chalk-500">By exercise</h2>
        <div className="mt-2 flex flex-col gap-2">
          {summary.exercises.map((e) => (
            <div
              key={e.exerciseId}
              className="flex items-center justify-between rounded-xl border border-steel-700 bg-steel-900 px-4 py-3"
            >
              <div>
                <p className="text-chalk-100">
                  {e.exerciseName}
                  {e.isPR && (
                    <span className="ml-2 rounded-md bg-tungsten-600/30 px-2 py-0.5 font-mono text-[10px] uppercase text-tungsten-400">
                      PR
                    </span>
                  )}
                </p>
                <p className="mt-0.5 font-mono text-xs text-chalk-500">
                  {e.isCardio
                    ? `${Math.round(e.totalDurationSeconds / 60)} min`
                    : `${e.setCount} set${e.setCount === 1 ? "" : "s"}${
                        e.topWeight != null ? ` · top ${e.topWeight} lb` : ""
                      }`}
                </p>
              </div>
              {!e.isCardio && (
                <p className="font-mono text-sm text-chalk-300">{e.volume.toLocaleString()} lb</p>
              )}
            </div>
          ))}
          {summary.exercises.length === 0 && (
            <p className="text-sm text-chalk-500">No sets logged this workout.</p>
          )}
        </div>
      </section>

      {difficultyBreakdown.length > 0 && (
        <section className="mt-6 rounded-2xl border border-steel-700 bg-steel-900 p-4">
          <h2 className="font-mono text-xs uppercase tracking-widest text-chalk-500">
            Effort calibration
          </h2>
          <div className="mt-2">
            <DifficultyChart data={difficultyBreakdown} />
          </div>
        </section>
      )}

      <div className="mt-6 flex gap-2">
        <Link
          href="/"
          className="flex-1 rounded-xl bg-copper-500 py-3 text-center font-semibold text-steel-950"
        >
          Back to Home
        </Link>
        <Link
          href="/progress"
          className="flex-1 rounded-xl border border-steel-600 py-3 text-center font-semibold text-chalk-300"
        >
          View Progress
        </Link>
      </div>
    </main>
  );
}
