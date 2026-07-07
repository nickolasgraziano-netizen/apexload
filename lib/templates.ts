import type { SupabaseClient } from "@supabase/supabase-js";

async function writeTemplateExercises(
  supabase: SupabaseClient,
  templateId: string,
  exerciseIds: string[],
  supersetGroups: string[][]
) {
  await supabase.from("workout_template_exercises").insert(
    exerciseIds.map((exerciseId, position) => ({
      template_id: templateId,
      exercise_id: exerciseId,
      position,
    }))
  );

  for (const groupExerciseIds of supersetGroups) {
    const { data: templateGroup } = await supabase
      .from("workout_template_superset_groups")
      .insert({ template_id: templateId })
      .select()
      .single();
    if (!templateGroup) continue;
    await supabase.from("workout_template_superset_group_exercises").insert(
      groupExerciseIds.map((exerciseId, position) => ({
        group_id: templateGroup.id,
        exercise_id: exerciseId,
        position,
      }))
    );
  }
}

/**
 * Saves a named exercise list (with optional superset pairings) as a
 * reusable workout_template. Shared by the live workout's "Save as
 * template", the from-scratch builder, and workout planning — all three
 * end up writing the same three tables.
 */
export async function saveWorkoutTemplate(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  exerciseIds: string[],
  supersetGroups: string[][],
  notes: string | null = null
): Promise<string | null> {
  const { data: template } = await supabase
    .from("workout_templates")
    .insert({ user_id: userId, name, notes })
    .select()
    .single();
  if (!template) return null;

  await writeTemplateExercises(supabase, template.id, exerciseIds, supersetGroups);

  return template.id as string;
}

/**
 * Replaces an existing template's name/notes and its full exercise list —
 * dropping and re-inserting the exercise/superset rows is safe because
 * nothing else references them by id (sessions link to exercises directly
 * via sets.exercise_id, not through the template's join rows).
 */
export async function updateWorkoutTemplate(
  supabase: SupabaseClient,
  templateId: string,
  name: string,
  exerciseIds: string[],
  supersetGroups: string[][],
  notes: string | null = null
): Promise<boolean> {
  const { error } = await supabase
    .from("workout_templates")
    .update({ name, notes })
    .eq("id", templateId);
  if (error) return false;

  await supabase.from("workout_template_exercises").delete().eq("template_id", templateId);
  await supabase.from("workout_template_superset_groups").delete().eq("template_id", templateId);

  await writeTemplateExercises(supabase, templateId, exerciseIds, supersetGroups);

  return true;
}
