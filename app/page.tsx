import { createClient } from "@/lib/supabase/server";
import { predictNextMuscleGroup } from "@/lib/rotation";
import { computeSessionsPerWeek, isoWeekStart } from "@/lib/metrics";
import { buildMotivationalMessage, findLatestPR } from "@/lib/motivation";
import RotationWheel from "@/components/RotationWheel";
import LogoutButton from "@/components/LogoutButton";
import Greeting from "@/components/Greeting";
import TemplateList from "@/components/TemplateList";
import type { OrderedMuscleGroup, WorkoutSession, WorkoutTemplate } from "@/lib/types";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
    : { data: null };

  // Join the user's personal rotation order onto the global muscle group
  // taxonomy — one query, sorted the way this user has arranged their split.
  const { data: rotation } = await supabase
    .from("user_rotation")
    .select("sort_order, muscle_groups ( id, name )")
    .order("sort_order");

  const muscleGroups: OrderedMuscleGroup[] = (rotation ?? []).map((r: any) => ({
    id: r.muscle_groups.id,
    name: r.muscle_groups.name,
    sort_order: r.sort_order,
  }));

  // Template-launched sessions have no muscle_group_id — they're a
  // separate track from the rotation, so they're excluded here.
  const { data: lastSession } = await supabase
    .from("sessions")
    .select("*")
    .not("ended_at", "is", null)
    .not("muscle_group_id", "is", null)
    .order("ended_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Unfinished sessions (interrupted workouts) — resumable, and there can
  // be more than one if the lifter bounced between muscle groups (or
  // started a template, which shows its own name instead of a group).
  const { data: openSessions } = await supabase
    .from("sessions")
    .select("id, started_at, muscle_groups ( name ), workout_templates ( name )")
    .is("ended_at", null)
    .order("started_at", { ascending: false });

  const { data: templates } = await supabase
    .from("workout_templates")
    .select("*")
    .order("created_at", { ascending: false });

  const predicted = predictNextMuscleGroup(muscleGroups, lastSession as WorkoutSession | null);

  // Motivational message: prefers a just-hit PR, then this week's
  // consistency against the rotation's target, then generic encouragement.
  const { data: allSessionsForWeek } = await supabase
    .from("sessions")
    .select("started_at, ended_at")
    .order("started_at", { ascending: false })
    .limit(200);
  const { data: recentSetRows } = await supabase
    .from("sets")
    .select("weight, logged_at, exercise_id, exercises ( name )")
    .not("weight", "is", null)
    .order("logged_at", { ascending: false })
    .limit(500);

  const prCandidates = (recentSetRows ?? [])
    .filter((s: any) => s.exercises?.name)
    .map((s: any) => ({
      exerciseId: s.exercise_id,
      exerciseName: s.exercises.name,
      weight: s.weight,
      loggedAt: s.logged_at,
    }));
  const latestPR = findLatestPR(prCandidates);

  const weeklyCounts = computeSessionsPerWeek(allSessionsForWeek ?? []);
  const currentWeek = isoWeekStart(new Date());
  const sessionsThisWeek = weeklyCounts.find((w) => w.weekStart === currentWeek)?.count ?? 0;

  const message = buildMotivationalMessage({
    latestPR,
    sessionsThisWeek,
    targetPerWeek: muscleGroups.length || undefined,
    seed: (allSessionsForWeek ?? []).length,
  });

  return (
    <main className="min-h-screen px-5 pb-24 pt-8">
      <header className="mb-8 flex flex-col gap-3">
        {user && <Greeting userId={user.id} displayName={profile?.display_name ?? null} message={message} />}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/progress" className="font-mono text-xs text-chalk-500 underline">
            Progress
          </Link>
          <Link href="/history" className="font-mono text-xs text-chalk-500 underline">
            History
          </Link>
          <Link href="/exercises" className="font-mono text-xs text-chalk-500 underline">
            Catalog
          </Link>
          <LogoutButton />
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <Link
          href={`/workout/new?muscleGroupId=${predicted?.id ?? ""}`}
          className="flex items-center justify-between rounded-xl border border-steel-700 bg-steel-900 px-4 py-3"
        >
          <div>
            <p className="text-chalk-100">Start a new workout</p>
            <p className="mt-0.5 text-xs text-chalk-500">
              Today's suggestion: {predicted?.name ?? "—"}
            </p>
          </div>
          <span className="font-mono text-xs text-copper-400">→</span>
        </Link>
        <Link
          href="/history"
          className="flex items-center justify-between rounded-xl border border-steel-700 bg-steel-900 px-4 py-3"
        >
          <div>
            <p className="text-chalk-100">Repeat a past workout</p>
            <p className="mt-0.5 text-xs text-chalk-500">Pick any day from your history</p>
          </div>
          <span className="font-mono text-xs text-copper-400">→</span>
        </Link>
        <Link
          href="/workout/import"
          className="flex items-center justify-between rounded-xl border border-steel-700 bg-steel-900 px-4 py-3"
        >
          <div>
            <p className="text-chalk-100">Log past workouts</p>
            <p className="mt-0.5 text-xs text-chalk-500">From your log book — by photo or typed in</p>
          </div>
          <span className="font-mono text-xs text-copper-400">→</span>
        </Link>
      </section>

      <div className="mt-6">
        <RotationWheel groups={muscleGroups} predictedGroupId={predicted?.id ?? ""} />
      </div>

      {/* Interrupted workouts — pick back up right where you left off */}
      {openSessions && openSessions.length > 0 && (
        <section className="mt-6 flex flex-col gap-2">
          <h3 className="font-mono text-xs uppercase tracking-widest text-tungsten-400">
            Resume workout
          </h3>
          {openSessions.map((s: any) => (
            <Link
              key={s.id}
              href={`/workout/${s.id}`}
              className="flex items-center justify-between rounded-xl border border-tungsten-500 bg-tungsten-600/10 px-4 py-3"
            >
              <div>
                <p className="text-chalk-100">
                  {s.muscle_groups?.name ?? s.workout_templates?.name ?? "Workout"}
                </p>
                <p className="mt-0.5 font-mono text-xs text-chalk-500">
                  Started{" "}
                  {new Date(s.started_at).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <span className="font-mono text-xs text-tungsten-400">Continue →</span>
            </Link>
          ))}
        </section>
      )}

      {user && <TemplateList templates={(templates ?? []) as WorkoutTemplate[]} userId={user.id} />}

      {/* Predicted workout highlight card */}
      <section className="mt-8 rounded-2xl border border-steel-700 bg-steel-900 p-5">
        <p className="font-mono text-xs uppercase tracking-widest text-tungsten-400">
          Suggested for today
        </p>
        <h2 className="mt-1 font-display text-3xl font-extrabold text-chalk-100">
          {predicted?.name ?? "—"}
        </h2>
        <div className="mt-4 flex gap-3">
          <Link
            href={`/workout/new?muscleGroupId=${predicted?.id ?? ""}`}
            className="flex-1 rounded-xl bg-copper-500 px-4 py-3 text-center font-body font-semibold text-steel-950 active:bg-copper-600"
          >
            Start this workout
          </Link>
          <details className="relative">
            <summary className="list-none rounded-xl border border-steel-600 px-4 py-3 text-sm text-chalk-300">
              Override
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-48 rounded-xl border border-steel-700 bg-steel-800 p-2 shadow-xl">
              {muscleGroups.map((g) => (
                <Link
                  key={g.id}
                  href={`/workout/new?muscleGroupId=${g.id}`}
                  className="block rounded-lg px-3 py-2 text-sm text-chalk-300 hover:bg-steel-700"
                >
                  {g.name}
                </Link>
              ))}
            </div>
          </details>
        </div>
      </section>

      {/* Last session lookback */}
      <section className="mt-6">
        <h3 className="font-mono text-xs uppercase tracking-widest text-chalk-500">
          Last session
        </h3>
        {lastSession ? (
          <div className="mt-2 rounded-2xl border border-steel-700 bg-steel-900 p-4">
            <p className="font-body text-chalk-100">
              {muscleGroups.find((g) => g.id === (lastSession as WorkoutSession).muscle_group_id)
                ?.name ?? "Unknown group"}
            </p>
            <p className="mt-1 font-mono text-xs text-chalk-500">
              {new Date((lastSession as WorkoutSession).ended_at!).toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-chalk-500">
            No sessions logged yet — start your first workout above.
          </p>
        )}
      </section>
    </main>
  );
}
