import { createClient } from "@/lib/supabase/server";
import { computeSessionsPerWeek, isoWeekStart } from "@/lib/metrics";
import { buildMotivationalMessage, findLatestPR } from "@/lib/motivation";
import LogoutButton from "@/components/LogoutButton";
import Greeting from "@/components/Greeting";
import TemplateList from "@/components/TemplateList";
import DismissSessionButton from "@/components/DismissSessionButton";
import BruceLeeQuote from "@/components/BruceLeeQuote";
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
    .select("sort_order, muscle_groups ( id, name, owner_id, is_global )")
    .order("sort_order");

  const muscleGroups: OrderedMuscleGroup[] = (rotation ?? []).map((r: any) => ({
    id: r.muscle_groups.id,
    name: r.muscle_groups.name,
    owner_id: r.muscle_groups.owner_id,
    is_global: r.muscle_groups.is_global,
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
  // Only today's — older ones fall off Home automatically (still
  // resumable from History for a few days) — and never ones the lifter
  // manually removed from this list.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const { data: openSessions } = await supabase
    .from("sessions")
    .select("id, started_at, muscle_groups ( name ), workout_templates ( name )")
    .is("ended_at", null)
    .is("dismissed_at", null)
    .gte("started_at", startOfToday.toISOString())
    .order("started_at", { ascending: false });

  const { data: templates } = await supabase
    .from("workout_templates")
    .select("*")
    .order("created_at", { ascending: false });

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
  });

  return (
    <main className="apex-page relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-cover"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgb(var(--color-steel-950) / 0.04), rgb(var(--color-steel-950) / 0.26) 38%, rgb(var(--color-steel-950) / 0.72) 72%, rgb(var(--color-steel-950)) 100%), linear-gradient(to right, rgb(var(--color-steel-950) / 0.68), rgb(var(--color-steel-950) / 0.16) 54%, rgb(var(--color-steel-950) / 0.04)), url('/home-bg.jpg')",
          backgroundPosition: "58% 34%",
        }}
      />
      <div className="relative">
      <header className="mb-7 flex flex-col gap-4 pt-1">
        {user && <Greeting userId={user.id} displayName={profile?.display_name ?? null} message={message} />}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/progress"
            className="apex-chip"
          >
            Progress
          </Link>
          <Link
            href="/history"
            className="apex-chip"
          >
            History
          </Link>
          <Link
            href="/exercises"
            className="apex-chip"
          >
            Catalog
          </Link>
          <LogoutButton />
        </div>
      </header>

      <section className="mt-28">
        <Link
          href="/workout/new"
          className="apex-action-primary"
        >
          <div>
            <p>Start a new workout</p>
            <p className="mt-0.5 text-xs font-normal text-steel-800">
              Build it fresh, or reuse one you've done before
            </p>
          </div>
          <span className="font-mono text-xs">→</span>
        </Link>
      </section>

      <section className="mt-3 flex flex-col gap-2">
        <Link
          href="/history"
          className="apex-action"
        >
          <div>
            <p className="font-semibold text-chalk-100">Repeat a past workout</p>
            <p className="mt-0.5 text-xs text-chalk-500">Pick any day from your history</p>
          </div>
          <span className="font-mono text-xs text-copper-400">→</span>
        </Link>
        <Link
          href="/workout/import"
          className="apex-action"
        >
          <div>
            <p className="font-semibold text-chalk-100">Log past workouts</p>
            <p className="mt-0.5 text-xs text-chalk-500">From your log book — by photo or typed in</p>
          </div>
          <span className="font-mono text-xs text-copper-400">→</span>
        </Link>
      </section>

      <BruceLeeQuote className="mt-4 backdrop-blur-md" />

      {/* Interrupted workouts — pick back up right where you left off */}
      {openSessions && openSessions.length > 0 && (
        <section className="apex-section flex flex-col gap-2">
          <h3 className="apex-section-title text-tungsten-400">
            Resume workout
          </h3>
          {openSessions.map((s: any) => (
            <div
              key={s.id}
              className="apex-card-live flex items-center justify-between gap-3 backdrop-blur-md"
            >
              <Link href={`/workout/${s.id}`} className="flex-1">
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
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <Link href={`/workout/${s.id}`} className="font-mono text-xs text-tungsten-400">
                  Continue →
                </Link>
                <DismissSessionButton sessionId={s.id} />
              </div>
            </div>
          ))}
        </section>
      )}

      {user && <TemplateList templates={(templates ?? []) as WorkoutTemplate[]} userId={user.id} />}

      {/* Last session lookback */}
      <section className="apex-section">
        <h3 className="apex-section-title">
          Last session
        </h3>
        {lastSession ? (
          <div className="apex-card-soft mt-2 backdrop-blur-md">
            <p className="font-semibold text-chalk-100">
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
      </div>
    </main>
  );
}
