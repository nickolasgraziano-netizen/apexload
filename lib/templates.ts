import type { SupabaseClient } from "@supabase/supabase-js";

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

  await supabase.from("workout_template_exercises").insert(
    exerciseIds.map((exerciseId, position) => ({
      template_id: template.id,
      exercise_id: exerciseId,
      position,
    }))
  );

  for (const groupExerciseIds of supersetGroups) {
    const { data: templateGroup } = await supabase
      .from("workout_template_superset_groups")
      .insert({ template_id: template.id })
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

  return template.id as string;
}
