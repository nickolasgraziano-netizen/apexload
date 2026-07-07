"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { WorkoutTemplate } from "@/lib/types";

export default function TemplateList({
  templates,
  userId,
}: {
  templates: WorkoutTemplate[];
  userId: string;
}) {
  const router = useRouter();
  const [startingId, setStartingId] = useState<string | null>(null);

  async function startTemplate(template: WorkoutTemplate) {
    setStartingId(template.id);
    const supabase = createClient();

    const { data: templateExercises } = await supabase
      .from("workout_template_exercises")
      .select("exercise_id, position")
      .eq("template_id", template.id)
      .order("position");
    const exerciseIds = (templateExercises ?? []).map((e) => e.exercise_id);

    const { data: templateGroups } = await supabase
      .from("workout_template_superset_groups")
      .select("id, workout_template_superset_group_exercises ( exercise_id, position )")
      .eq("template_id", template.id);

    const { data: session } = await supabase
      .from("sessions")
      .insert({ user_id: userId, muscle_group_id: null, template_id: template.id })
      .select()
      .single();

    if (!session) {
      setStartingId(null);
      return;
    }

    sessionStorage.setItem(`apexload:plan:${session.id}`, JSON.stringify(exerciseIds));

    for (const group of templateGroups ?? []) {
      const exercises = ((group as any).workout_template_superset_group_exercises ?? []).sort(
        (a: any, b: any) => a.position - b.position
      );
      const { data: newGroup } = await supabase
        .from("superset_groups")
        .insert({ session_id: session.id, user_id: userId })
        .select()
        .single();
      if (!newGroup) continue;
      await supabase.from("superset_group_exercises").insert(
        exercises.map((e: any, position: number) => ({
          group_id: newGroup.id,
          exercise_id: e.exercise_id,
          position,
        }))
      );
    }

    router.push(`/workout/${session.id}`);
  }

  if (templates.length === 0) return null;

  return (
    <section className="mt-6 flex flex-col gap-2">
      <h3 className="font-mono text-xs uppercase tracking-widest text-chalk-500">Templates</h3>
      {templates.map((t) => (
        <div
          key={t.id}
          className="flex items-center justify-between rounded-xl border border-steel-700 bg-steel-900 px-4 py-3"
        >
          <div>
            <span className="text-chalk-100">{t.name}</span>
            {t.notes && <p className="mt-0.5 text-xs text-chalk-500">{t.notes}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/workout/plan/edit/${t.id}`}
              className="rounded-lg border border-steel-600 px-3 py-1.5 text-xs text-chalk-300"
            >
              Edit
            </Link>
            <button
              onClick={() => startTemplate(t)}
              disabled={startingId === t.id}
              className="rounded-lg bg-copper-500 px-3 py-1.5 text-xs font-semibold text-steel-950 disabled:opacity-50"
            >
              {startingId === t.id ? "Starting…" : "Start"}
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
