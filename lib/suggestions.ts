import type { LoggedSet, TrainingVariant } from "@/lib/types";

export interface WeightSuggestion {
  suggestedWeight: number | null;
  reason: "increase" | "hold" | "no_history";
  incrementOptions: number[]; // e.g. [5, 10]
}

/**
 * Suggests next-session weight for an exercise, pulling history ONLY from
 * sets logged under the same training_variant. Standard and TUT sessions
 * never influence each other's suggestions, since TUT deliberately drops
 * strength output at the same weight.
 */
export function suggestNextWeight(
  pastSets: LoggedSet[],
  exerciseId: string,
  variant: TrainingVariant
): WeightSuggestion {
  const relevant = pastSets
    .filter((s) => s.exercise_id === exerciseId && s.training_variant === variant)
    .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());

  if (relevant.length === 0) {
    return { suggestedWeight: null, reason: "no_history", incrementOptions: [] };
  }

  const lastWeight = relevant[0].weight ?? 0;
  const lastDifficulty = relevant[0].difficulty;
  const hitTargetReps =
    relevant[0].actual_reps != null && relevant[0].actual_reps >= relevant[0].target_reps;

  const shouldIncrease = hitTargetReps && lastDifficulty === "easy";
  const shouldHold =
    !hitTargetReps || lastDifficulty === "difficult" || lastDifficulty === "failed";

  if (shouldIncrease) {
    return {
      suggestedWeight: lastWeight,
      reason: "increase",
      incrementOptions: [5, 10],
    };
  }

  if (shouldHold) {
    return { suggestedWeight: lastWeight, reason: "hold", incrementOptions: [] };
  }

  // Moderate difficulty, hit reps: hold as the safe default.
  return { suggestedWeight: lastWeight, reason: "hold", incrementOptions: [] };
}
