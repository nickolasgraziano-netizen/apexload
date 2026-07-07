"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import WorkoutBuilder, { type WorkoutBuilderSaveArgs } from "@/components/WorkoutBuilder";
import { saveWorkoutTemplate } from "@/lib/templates";

// Build a workout and start logging it immediately. Naming it IS saving
// it — it becomes a reusable template right away, and the live session
// launches from that template.
export default function BuildWorkoutPage() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  async function handleSave({ name, selected, pendingGroups }: WorkoutBuilderSaveArgs) {
    setStarting(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setStarting(false);
      return;
    }

    const templateId = await saveWorkoutTemplate(
      supabase,
      user.id,
      name,
      selected.map((e) => e.id),
      pendingGroups
    );
    if (!templateId) {
      setStarting(false);
      return;
    }

    const { data: session } = await supabase
      .from("sessions")
      .insert({ user_id: user.id, muscle_group_id: null, template_id: templateId })
      .select()
      .single();
    if (!session) {
      setStarting(false);
      return;
    }

    sessionStorage.setItem(
      `apexload:plan:${session.id}`,
      JSON.stringify(selected.map((e) => e.id))
    );

    for (const exerciseIds of pendingGroups) {
      const { data: group } = await supabase
        .from("superset_groups")
        .insert({ session_id: session.id, user_id: user.id })
        .select()
        .single();
      if (!group) continue;
      await supabase.from("superset_group_exercises").insert(
        exerciseIds.map((exerciseId, position) => ({
          group_id: group.id,
          exercise_id: exerciseId,
          position,
        }))
      );
    }

    router.push(`/workout/${session.id}`);
  }

  return (
    <WorkoutBuilder
      title="Build a workout"
      saving={starting}
      saveLabel="Save & start workout"
      savingLabel="Saving…"
      onSave={handleSave}
    />
  );
}
