"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import WorkoutBuilder, { type WorkoutBuilderSaveArgs } from "@/components/WorkoutBuilder";
import { updateWorkoutTemplate } from "@/lib/templates";
import type { Exercise } from "@/lib/types";

// Edit an existing saved plan — same builder UI as building/planning a new
// one, just pre-populated and writing back to the same template row instead
// of creating a new one.
export default function EditPlanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialName, setInitialName] = useState("");
  const [initialSelected, setInitialSelected] = useState<Exercise[]>([]);
  const [initialPendingGroups, setInitialPendingGroups] = useState<string[][]>([]);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: template } = await supabase
        .from("workout_templates")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!template) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: templateExercises } = await supabase
        .from("workout_template_exercises")
        .select("exercise_id, position, exercises ( * )")
        .eq("template_id", id)
        .order("position");

      const { data: templateGroups } = await supabase
        .from("workout_template_superset_groups")
        .select("id, workout_template_superset_group_exercises ( exercise_id, position )")
        .eq("template_id", id);

      setInitialName(template.name);
      setInitialSelected(
        (templateExercises ?? [])
          .map((te) => te.exercises as unknown as Exercise)
          .filter(Boolean)
      );
      setInitialPendingGroups(
        (templateGroups ?? []).map((g) =>
          ((g.workout_template_superset_group_exercises ?? []) as { exercise_id: string; position: number }[])
            .sort((a, b) => a.position - b.position)
            .map((e) => e.exercise_id)
        )
      );
      setLoading(false);
    })();
  }, [id]);

  async function handleSave({ name, selected, pendingGroups }: WorkoutBuilderSaveArgs) {
    setSaving(true);
    const supabase = createClient();

    const ok = await updateWorkoutTemplate(
      supabase,
      id,
      name,
      selected.map((e) => e.id),
      pendingGroups
    );
    if (!ok) {
      setSaving(false);
      return;
    }

    router.push("/");
  }

  if (loading) return null;

  if (notFound) {
    return (
      <main className="min-h-screen px-5 pb-24 pt-8">
        <p className="text-sm text-chalk-500">
          Couldn't find that plan — it may have been deleted.
        </p>
      </main>
    );
  }

  return (
    <WorkoutBuilder
      title="Edit plan"
      subtitle="Rename it, add or remove exercises, or fix an exercise's name."
      saving={saving}
      saveLabel="Save changes"
      savingLabel="Saving…"
      onSave={handleSave}
      initialName={initialName}
      initialSelected={initialSelected}
      initialPendingGroups={initialPendingGroups}
    />
  );
}
