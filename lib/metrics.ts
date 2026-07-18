import type { SetDifficulty, TrainingVariant } from "@/lib/types";

interface VolumeSetInput {
  weight: number | null;
  actual_reps: number | null;
  logged_at: string;
  muscle_group_id: string;
}

export interface WeeklyMuscleVolume {
  weekStart: string; // Monday of the ISO week, YYYY-MM-DD
  muscleGroupId: string;
  volume: number; // sum(weight * actual_reps)
}

/** Monday of the ISO week containing the given date, as YYYY-MM-DD. */
export function isoWeekStart(dateStr: string | Date): string {
  const d = new Date(dateStr);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * Total training volume (weight × reps), grouped by ISO week and muscle
 * group. Sets with no weight or rep count logged don't contribute.
 */
export function computeWeeklyVolume(sets: VolumeSetInput[]): WeeklyMuscleVolume[] {
  const buckets = new Map<string, WeeklyMuscleVolume>();
  for (const s of sets) {
    if (s.weight == null || s.actual_reps == null) continue;
    const weekStart = isoWeekStart(s.logged_at);
    const key = `${weekStart}|${s.muscle_group_id}`;
    const existing = buckets.get(key);
    const volume = s.weight * s.actual_reps;
    if (existing) {
      existing.volume += volume;
    } else {
      buckets.set(key, { weekStart, muscleGroupId: s.muscle_group_id, volume });
    }
  }
  return [...buckets.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export interface DifficultyBreakdown {
  difficulty: SetDifficulty;
  count: number;
}

const DIFFICULTY_ORDER: SetDifficulty[] = ["easy", "moderate", "difficult", "failed"];

/** Count of logged sets per difficulty rating. Sets with no rating are excluded. */
export function computeDifficultyBreakdown(
  sets: { difficulty: SetDifficulty | null }[]
): DifficultyBreakdown[] {
  const counts = new Map<SetDifficulty, number>();
  for (const s of sets) {
    if (!s.difficulty) continue;
    counts.set(s.difficulty, (counts.get(s.difficulty) ?? 0) + 1);
  }
  return DIFFICULTY_ORDER.filter((d) => counts.has(d)).map((difficulty) => ({
    difficulty,
    count: counts.get(difficulty)!,
  }));
}

export interface VariantSplit {
  variant: TrainingVariant;
  count: number;
}

/** Count of logged sets per training variant (standard vs. time-under-tension). */
export function computeVariantSplit(sets: { training_variant: TrainingVariant }[]): VariantSplit[] {
  const counts = new Map<TrainingVariant, number>();
  for (const s of sets) {
    counts.set(s.training_variant, (counts.get(s.training_variant) ?? 0) + 1);
  }
  return (["standard", "tut"] as TrainingVariant[])
    .filter((v) => counts.has(v))
    .map((variant) => ({ variant, count: counts.get(variant)! }));
}

export interface MuscleGroupFreshness {
  muscleGroupId: string;
  daysSinceLastTrained: number | null; // null = never trained
}

/**
 * How long it's been since each muscle group was last trained, measured
 * from logged sets (via each set's exercise) rather than sessions — a
 * session no longer carries a single muscle group now that templates mix
 * muscle groups freely. Surfaces neglected groups at a glance.
 */
export function computeMuscleGroupFreshness(
  sets: { muscle_group_id: string; logged_at: string }[],
  muscleGroupIds: string[],
  now: Date = new Date()
): MuscleGroupFreshness[] {
  const lastTrained = new Map<string, number>();
  for (const s of sets) {
    const t = new Date(s.logged_at).getTime();
    const current = lastTrained.get(s.muscle_group_id);
    if (current == null || t > current) lastTrained.set(s.muscle_group_id, t);
  }
  return muscleGroupIds.map((muscleGroupId) => {
    const last = lastTrained.get(muscleGroupId);
    return {
      muscleGroupId,
      daysSinceLastTrained:
        last == null ? null : Math.floor((now.getTime() - last) / (1000 * 60 * 60 * 24)),
    };
  });
}

export interface WeeklySessionCount {
  weekStart: string;
  count: number;
}

/** Completed sessions per ISO week, for a consistency trend. */
export function computeSessionsPerWeek(
  sessions: { started_at: string; ended_at: string | null }[]
): WeeklySessionCount[] {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    if (!s.ended_at) continue;
    const weekStart = isoWeekStart(s.started_at);
    counts.set(weekStart, (counts.get(weekStart) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([weekStart, count]) => ({ weekStart, count }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export interface WeeklyCalories {
  weekStart: string;
  calories: number;
}

/** Total calories burned (cardio sets only) per ISO week. */
export function computeWeeklyCalories(
  sets: { calories: number | null; logged_at: string }[]
): WeeklyCalories[] {
  const totals = new Map<string, number>();
  for (const s of sets) {
    if (s.calories == null) continue;
    const weekStart = isoWeekStart(s.logged_at);
    totals.set(weekStart, (totals.get(weekStart) ?? 0) + s.calories);
  }
  return [...totals.entries()]
    .map(([weekStart, calories]) => ({ weekStart, calories }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/** Total calories burned (cardio sets only) across all logged history. */
export function computeTotalCalories(sets: { calories: number | null }[]): number {
  return sets.reduce((sum, s) => sum + (s.calories ?? 0), 0);
}

/** Whole minutes between two ISO timestamps, floored at 0. */
export function computeDurationMinutes(startedAt: string, endedAt: string): number {
  return Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000));
}

export interface SessionSetInput {
  exercise_id: string;
  weight: number | null;
  actual_reps: number | null;
  duration_seconds: number | null;
}

export interface SessionExerciseSummary {
  exerciseId: string;
  exerciseName: string;
  isCardio: boolean;
  setCount: number;
  volume: number; // 0 for cardio
  topWeight: number | null; // heaviest single set this session; null for cardio/unlogged
  totalDurationSeconds: number; // 0 for strength exercises
  isPR: boolean; // topWeight beat every prior all-time set for this exercise
}

export interface SessionSummary {
  totalSets: number;
  totalVolume: number;
  prCount: number;
  exercises: SessionExerciseSummary[];
}

/**
 * Rolls up one session's logged sets into a per-exercise breakdown plus
 * session-wide totals. A PR is "this session's top weight beat every prior
 * set for that exercise" — including exercises with no prior history at
 * all, consistent with findLatestPR's treatment of a first-ever set.
 */
export function computeSessionSummary(
  sets: SessionSetInput[],
  exerciseInfo: Map<string, { name: string; isCardio: boolean }>,
  priorMaxWeightByExercise: Map<string, number>
): SessionSummary {
  const byExercise = new Map<string, SessionSetInput[]>();
  for (const s of sets) {
    const list = byExercise.get(s.exercise_id) ?? [];
    list.push(s);
    byExercise.set(s.exercise_id, list);
  }

  const exercises: SessionExerciseSummary[] = [];
  let totalVolume = 0;
  let prCount = 0;

  for (const [exerciseId, exSets] of byExercise) {
    const info = exerciseInfo.get(exerciseId);
    const exerciseName = info?.name ?? "Unknown exercise";
    const isCardio = info?.isCardio ?? false;
    const volume = exSets.reduce(
      (sum, s) => sum + (s.weight != null && s.actual_reps != null ? s.weight * s.actual_reps : 0),
      0
    );
    const topWeight = exSets.reduce<number | null>(
      (max, s) => (s.weight != null && (max == null || s.weight > max) ? s.weight : max),
      null
    );
    const totalDurationSeconds = exSets.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
    const priorMax = priorMaxWeightByExercise.get(exerciseId) ?? 0;
    const isPR = !isCardio && topWeight != null && topWeight > priorMax;
    if (isPR) prCount++;
    totalVolume += volume;
    exercises.push({
      exerciseId,
      exerciseName,
      isCardio,
      setCount: exSets.length,
      volume,
      topWeight,
      totalDurationSeconds,
      isPR,
    });
  }

  return {
    totalSets: sets.length,
    totalVolume,
    prCount,
    exercises: exercises.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName)),
  };
}
