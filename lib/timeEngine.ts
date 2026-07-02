import type { Exercise, LoggedSet } from "@/lib/types";

/**
 * Historical average duration (minutes) for a single exercise, measured
 * from the first logged set to the final logged set within each past
 * session that included it.
 */
export function averageExerciseDurationMinutes(
  setsForExercise: LoggedSet[]
): number | null {
  if (setsForExercise.length === 0) return null;

  const bySession = new Map<string, LoggedSet[]>();
  for (const s of setsForExercise) {
    const bucket = bySession.get(s.session_id) ?? [];
    bucket.push(s);
    bySession.set(s.session_id, bucket);
  }

  const durations: number[] = [];
  for (const sets of bySession.values()) {
    if (sets.length < 2) continue; // need first + last set to measure a span
    const times = sets.map((s) => new Date(s.logged_at).getTime()).sort((a, b) => a - b);
    const spanMinutes = (times[times.length - 1] - times[0]) / 60000;
    if (spanMinutes > 0) durations.push(spanMinutes);
  }

  if (durations.length === 0) return null;
  return durations.reduce((a, b) => a + b, 0) / durations.length;
}

/**
 * Estimated total duration for a planned list of exercises, using each
 * exercise's historical average (falling back to a conservative default
 * for exercises with no history yet).
 */
export function estimateWorkoutDurationMinutes(
  plannedExerciseIds: string[],
  averagesByExerciseId: Map<string, number | null>,
  fallbackMinutesPerExercise = 8
): number {
  return plannedExerciseIds.reduce((total, id) => {
    const avg = averagesByExerciseId.get(id);
    return total + (avg ?? fallbackMinutesPerExercise);
  }, 0);
}

interface CandidateExercise {
  exercise: Exercise;
  estimatedMinutes: number;
}

/**
 * Auto-generates a diverse exercise list for a muscle group that fits
 * within a hard time budget. Greedily balances sub-muscle coverage first
 * (round-robin across sub-muscles), then fills remaining time with the
 * best-fitting leftover exercises.
 */
export function generateTimeConstrainedWorkout(
  candidates: CandidateExercise[],
  budgetMinutes: number
): Exercise[] {
  const bySubMuscle = new Map<string, CandidateExercise[]>();
  for (const c of candidates) {
    const key = c.exercise.sub_muscle_id ?? "unspecified";
    const bucket = bySubMuscle.get(key) ?? [];
    bucket.push(c);
    bySubMuscle.set(key, bucket);
  }
  // Shortest-estimate-first within each sub-muscle so round-robin picks
  // efficient movements before expensive ones.
  for (const bucket of bySubMuscle.values()) {
    bucket.sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);
  }

  const subMuscleKeys = [...bySubMuscle.keys()];
  const selected: Exercise[] = [];
  let remaining = budgetMinutes;
  let progressed = true;

  // Round-robin across sub-muscles so no single one dominates the session.
  while (progressed && remaining > 0) {
    progressed = false;
    for (const key of subMuscleKeys) {
      const bucket = bySubMuscle.get(key)!;
      const next = bucket[0];
      if (next && next.estimatedMinutes <= remaining) {
        selected.push(next.exercise);
        remaining -= next.estimatedMinutes;
        bucket.shift();
        progressed = true;
      }
    }
  }

  return selected;
}
