"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import WorkoutBuilder, { type WorkoutBuilderSaveArgs } from "@/components/WorkoutBuilder";
import { saveWorkoutTemplate } from "@/lib/templates";

// Plan a workout ahead of time — same builder as /workout/build, but this
// just saves it as a template for later. No live session, no logging yet.
export default function PlanWorkoutPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSave({ name, selected, pendingGroups }: WorkoutBuilderSaveArgs) {
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
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
      setSaving(false);
      return;
    }

    router.push("/");
  }

  return (
    <WorkoutBuilder
      title="Plan a workout"
      subtitle="Save it now, start it whenever you're ready — no live logging yet."
      saving={saving}
      saveLabel="Save workout"
      savingLabel="Saving…"
      onSave={handleSave}
    />
  );
}
