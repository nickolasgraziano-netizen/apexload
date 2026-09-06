import type { SupabaseClient } from "@supabase/supabase-js";
import type { Exercise } from "@/lib/types";

export type ActivityType = "strength" | "cardio" | "mixed" | "mobility" | "other";
export type SessionEndReason = "manual" | "auto_inactivity" | "edited";

export const WORKOUT_INACTIVITY_LIMIT_MS = 3 * 60 * 60 * 1000;

export function inferActivityTypeFromExercises(
  exercises: Pick<Exercise, "is_cardio">[]
): ActivityType {
  if (exercises.length === 0) return "other";
  const cardioCount = exercises.filter((exercise) => exercise.is_cardio).length;
  if (cardioCount === 0) return "strength";
  if (cardioCount === exercises.length) return "cardio";
  return "mixed";
}

export function isSessionInactive(
  session: { ended_at: string | null; last_activity_at?: string | null },
  now = new Date()
): boolean {
  if (session.ended_at) return false;
  const lastActivityAt = session.last_activity_at ? new Date(session.last_activity_at) : null;
  if (!lastActivityAt || Number.isNaN(lastActivityAt.getTime())) return false;
  return now.getTime() - lastActivityAt.getTime() >= WORKOUT_INACTIVITY_LIMIT_MS;
}

export async function touchSession(
  supabase: SupabaseClient,
  sessionId: string,
  patch: { activity_type?: ActivityType } = {}
) {
  await supabase
    .from("sessions")
    .update({
      last_activity_at: new Date().toISOString(),
      ...patch,
    })
    .eq("id", sessionId)
    .is("ended_at", null);
}

export async function autoEndStaleSessions(supabase: SupabaseClient) {
  const cutoff = new Date(Date.now() - WORKOUT_INACTIVITY_LIMIT_MS).toISOString();
  const { data } = await supabase
    .from("sessions")
    .select("id, last_activity_at")
    .is("ended_at", null)
    .lt("last_activity_at", cutoff);

  const staleSessions = (data ?? []).filter((session) => session.last_activity_at);
  await Promise.all(
    staleSessions.map((session) =>
      supabase
        .from("sessions")
        .update({
          ended_at: session.last_activity_at,
          auto_ended_at: new Date().toISOString(),
          end_reason: "auto_inactivity" satisfies SessionEndReason,
        })
        .eq("id", session.id)
        .is("ended_at", null)
    )
  );
}

export async function inferActivityTypeFromExerciseIds(
  supabase: SupabaseClient,
  exerciseIds: string[]
): Promise<ActivityType> {
  if (exerciseIds.length === 0) return "other";
  const { data } = await supabase.from("exercises").select("is_cardio").in("id", exerciseIds);
  return inferActivityTypeFromExercises((data ?? []) as Pick<Exercise, "is_cardio">[]);
}
