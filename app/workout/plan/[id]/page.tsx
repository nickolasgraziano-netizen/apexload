"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deleteWorkoutTemplate, startWorkoutTemplate } from "@/lib/templates";
import type { Exercise, WorkoutTemplate } from "@/lib/types";

interface Item {
  exerciseId: string;
  exercise: Exercise;
}

// View a saved plan: its exercises in order, with reordering, plus quick
// access to the full editor and to starting it as a live workout.
export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [groupIndexByExerciseId, setGroupIndexByExerciseId] = useState<Map<string, number>>(
    new Map()
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [starting, setStarting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      const { data: tpl } = await supabase
        .from("workout_templates")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!tpl) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setTemplate(tpl as WorkoutTemplate);

      const { data: templateExercises } = await supabase
        .from("workout_template_exercises")
        .select("exercise_id, position, exercises ( * )")
        .eq("template_id", id)
        .order("position");
      setItems(
        (templateExercises ?? [])
          .filter((te) => te.exercises)
          .map((te) => ({
            exerciseId: te.exercise_id as string,
            exercise: te.exercises as unknown as Exercise,
          }))
      );

      const { data: templateGroups } = await supabase
        .from("workout_template_superset_groups")
        .select("id, workout_template_superset_group_exercises ( exercise_id )")
        .eq("template_id", id);
      const map = new Map<string, number>();
      (templateGroups ?? []).forEach((g, i) => {
        for (const ge of (g.workout_template_superset_group_exercises ??
          []) as { exercise_id: string }[]) {
          map.set(ge.exercise_id, i + 1);
        }
      });
      setGroupIndexByExerciseId(map);

      setLoading(false);
    })();
  }, [id]);

  async function move(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    const next = [...items];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    setItems(next);

    setReordering(true);
    const supabase = createClient();
    await Promise.all(
      next.map((item, i) =>
        supabase
          .from("workout_template_exercises")
          .update({ position: i })
          .eq("template_id", id)
          .eq("exercise_id", item.exerciseId)
      )
    );
    setReordering(false);
  }

  async function handleStart() {
    if (!userId) return;
    setStarting(true);
    const supabase = createClient();
    const sessionId = await startWorkoutTemplate(supabase, userId, id);
    if (!sessionId) {
      setStarting(false);
      return;
    }
    router.push(`/workout/${sessionId}`);
  }

  async function handleDelete() {
    if (!template) return;
    if (!confirm(`Delete "${template.name}"? This can't be undone.`)) return;
    setDeleting(true);
    const supabase = createClient();
    const ok = await deleteWorkoutTemplate(supabase, id);
    if (!ok) {
      setDeleting(false);
      return;
    }
    router.push("/");
  }

  if (loading) return null;

  if (notFound || !template) {
    return (
      <main className="min-h-screen px-5 pb-24 pt-8">
        <p className="text-sm text-chalk-500">
          Couldn't find that plan — it may have been deleted.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-24 pt-8">
      <p className="font-mono text-xs uppercase tracking-widest text-copper-500">Plan</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-chalk-100">
        {template.name}
      </h1>
      {template.notes && <p className="mt-1 text-sm text-chalk-500">{template.notes}</p>}

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-chalk-500">Exercises</h2>
        <Link
          href={`/workout/plan/edit/${id}`}
          className="rounded-lg border border-steel-600 px-3 py-1.5 text-xs text-chalk-300"
        >
          Edit
        </Link>
      </div>

      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item, i) => {
          const groupIndex = groupIndexByExerciseId.get(item.exerciseId);
          return (
            <li
              key={item.exerciseId}
              className="flex items-center gap-2 rounded-xl border border-steel-700 bg-steel-900 px-4 py-3"
            >
              <div className="flex-1">
                <span className="text-chalk-100">{item.exercise.name}</span>
                <div className="mt-0.5 flex flex-wrap gap-2">
                  {groupIndex && (
                    <span className="font-mono text-[10px] uppercase text-tungsten-400">
                      ⚡ Superset {groupIndex}
                    </span>
                  )}
                  {item.exercise.is_cardio && (
                    <span className="font-mono text-[10px] uppercase text-tungsten-400">
                      Cardio
                    </span>
                  )}
                  {item.exercise.is_unilateral && (
                    <span className="font-mono text-[10px] uppercase text-copper-400">
                      Per side
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || reordering}
                  className="rounded-lg border border-steel-600 px-2 py-1 text-xs text-chalk-300 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1 || reordering}
                  className="rounded-lg border border-steel-600 px-2 py-1 text-xs text-chalk-300 disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        onClick={handleStart}
        disabled={starting || items.length === 0}
        className="mt-8 w-full rounded-xl bg-copper-500 px-4 py-4 text-center font-body font-semibold text-steel-950 active:bg-copper-600 disabled:opacity-50"
      >
        {starting ? "Starting…" : "Start this workout"}
      </button>

      <button
        onClick={handleDelete}
        disabled={deleting}
        className="mt-3 w-full rounded-xl border border-copper-600 px-4 py-3 text-center text-sm text-copper-400 disabled:opacity-50"
      >
        {deleting ? "Deleting…" : "Delete this plan"}
      </button>
    </main>
  );
}
