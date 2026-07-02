import { createClient } from "@/lib/supabase/server";
import { predictNextMuscleGroup } from "@/lib/rotation";
import RotationWheel from "@/components/RotationWheel";
import type { OrderedMuscleGroup, WorkoutSession } from "@/lib/types";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const { data: lastSession } = await supabase
    .from("sessions")
    .select("*")
    .not("ended_at", "is", null)
    .order("ended_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const predicted = predictNextMuscleGroup(muscleGroups, lastSession as WorkoutSession | null);

  return (
    <main className="min-h-screen px-5 pb-24 pt-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-copper-500">ApexLoad</p>
          <h1 className="font-display text-2xl font-bold text-chalk-100">
            Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}
          </h1>
        </div>
        <Link href="/exercises" className="font-mono text-xs text-chalk-500 underline">
          Catalog
        </Link>
      </header>

      <RotationWheel groups={muscleGroups} predictedGroupId={predicted?.id ?? ""} />

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
