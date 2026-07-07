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
 * Launches a saved template as a live session: creates the session row,
 * stashes the planned exercise order for the workout screen to pick up,
 * and recreates the template's superset groups as live ones. Shared by
 * the Templates list on Home and the template detail page so "Start"
 * behaves identically from either place.
 */
export async function startWorkoutTemplate(
  supabase: SupabaseClient,
  userId: string,
  templateId: string
): Promise<string | null> {
  const { data: templateExercises } = await supabase
    .from("workout_template_exercises")
    .select("exercise_id, position")
    .eq("template_id", templateId)
    .order("position");
  const exerciseIds = (templateExercises ?? []).map((e) => e.exercise_id as string);

  const { data: templateGroups } = await supabase
    .from("workout_template_superset_groups")
    .select("id, workout_template_superset_group_exercises ( exercise_id, position )")
    .eq("template_id", templateId);

  const { data: session } = await supabase
    .from("sessions")
    .insert({ user_id: userId, muscle_group_id: null, template_id: templateId })
    .select()
    .single();
  if (!session) return null;

  sessionStorage.setItem(`apexload:plan:${session.id}`, JSON.stringify(exerciseIds));

  for (const group of templateGroups ?? []) {
    const exercises = (
      (group as { workout_template_superset_group_exercises: { exercise_id: string; position: number }[] })
        .workout_template_superset_group_exercises ?? []
    ).sort((a, b) => a.position - b.position);
    const { data: newGroup } = await supabase
      .from("superset_groups")
      .insert({ session_id: session.id, user_id: userId })
      .select()
      .single();
    if (!newGroup) continue;
    await supabase.from("superset_group_exercises").insert(
      exercises.map((e, position) => ({
        group_id: newGroup.id,
        exercise_id: e.exercise_id,
        position,
      }))
    );
  }

  return session.id as string;
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

/**
 * Deletes a saved plan outright — safe because its exercise/superset rows
 * cascade with it, and any session that was launched from it just loses
 * the reference (sessions.template_id is ON DELETE SET NULL) rather than
 * losing its own logged history.
 */
export async function deleteWorkoutTemplate(
  supabase: SupabaseClient,
  templateId: string
): Promise<boolean> {
  const { error } = await supabase.from("workout_templates").delete().eq("id", templateId);
  return !error;
}
