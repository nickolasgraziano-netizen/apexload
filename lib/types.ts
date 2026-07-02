export type TrainingVariant = "standard" | "tut";
export type SetDifficulty = "easy" | "moderate" | "difficult" | "failed";

// Global taxonomy — shared across all users, not user-owned.
export interface MuscleGroup {
  id: string;
  name: string;
}

export interface SubMuscle {
  id: string;
  muscle_group_id: string;
  name: string;
}

// A user's personal ordering through the muscle groups. This is what
// "sort_order" hangs off of now, not the muscle group itself, since one
// user's split shouldn't affect anyone else's rows or the global catalog.
export interface UserRotationEntry {
  id: string;
  user_id: string;
  muscle_group_id: string;
  sort_order: number;
}

export interface Exercise {
  id: string;
  owner_id: string | null; // null = global catalog
  muscle_group_id: string;
  sub_muscle_id: string | null;
  name: string;
  is_custom: boolean;
  default_rest_seconds: number;
}

export interface ExerciseAlternative {
  exercise_id: string;
  alternative_exercise_id: string;
  user_id: string;
}

export interface MachinePhoto {
  id: string;
  user_id: string;
  exercise_id: string;
  storage_path: string;
  visible_to_trainer: boolean;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  muscle_group_id: string;
  started_at: string;
  ended_at: string | null;
  time_budget_minutes: number | null;
}

export interface LoggedSet {
  id: string;
  session_id: string;
  user_id: string;
  exercise_id: string;
  training_variant: TrainingVariant;
  set_number: number;
  target_reps: number;
  actual_reps: number | null;
  weight: number | null;
  weight_unit: string;
  difficulty: SetDifficulty | null;
  logged_at: string;
}

// Convenience shape used across the dashboard/workout screens: a muscle
// group joined with the user's personal sort_order for that group.
export interface OrderedMuscleGroup extends MuscleGroup {
  sort_order: number;
}

// Minimal Database type placeholder — replace with the real generated types
// via the Supabase MCP connector's generate_typescript_types tool (or
// `supabase gen types typescript`) once the project schema is live.
export type Database = any;
