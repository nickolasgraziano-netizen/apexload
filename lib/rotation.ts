import type { OrderedMuscleGroup, WorkoutSession } from "@/lib/types";

/**
 * Predicts the next muscle group in the user's rolling rotation.
 * Pure day-of-week-agnostic: only cares about what was done last.
 *
 * Rule: find the muscle group of the most recent COMPLETED session,
 * then return the next one in sort_order (wrapping around). If the
 * user has never logged a session, default to the first in the cycle.
 */
export function predictNextMuscleGroup(
  groups: OrderedMuscleGroup[],
  lastCompletedSession: WorkoutSession | null
): OrderedMuscleGroup {
  const ordered = [...groups].sort((a, b) => a.sort_order - b.sort_order);

  if (!lastCompletedSession) {
    return ordered[0];
  }

  const lastIndex = ordered.findIndex(
    (g) => g.id === lastCompletedSession.muscle_group_id
  );

  if (lastIndex === -1) {
    // Muscle group was deleted/renamed since — fall back to first in cycle.
    return ordered[0];
  }

  const nextIndex = (lastIndex + 1) % ordered.length;
  return ordered[nextIndex];
}
