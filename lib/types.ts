export type TrainingVariant = "standard" | "tut";
export type SetDifficulty = "easy" | "moderate" | "difficult" | "failed";
export type SetSide = "left" | "right";

// Shared taxonomy — either global (owner_id null, is_global true) or a
// user-created custom group (e.g. "Cardio", "Elliptical", "Stair Climber").
export interface MuscleGroup {
  id: string;
  name: string;
  owner_id: string | null;
  is_global: boolean;
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
  is_unilateral: boolean; // trained one side at a time, e.g. single-arm pulldown
  is_cardio: boolean; // logged by duration + notes instead of sets of reps/weight
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
  muscle_group_id: string | null; // null when launched from a (muscle-group-agnostic) template
  template_id: string | null;
  name: string | null; // custom user-given name, overrides the muscle group/template display name
  started_at: string;
  ended_at: string | null;
  time_budget_minutes: number | null;
  notes: string | null;
  dismissed_at: string | null; // manually hidden from Home while still unfinished
}

// A saved, reusable exercise list (optionally with superset pairings) a
// user can relaunch as a new session. Deliberately not tied to a single
// muscle group, since a template can span the whole body.
export interface WorkoutTemplate {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  created_at: string;
}

export interface WorkoutTemplateExercise {
  template_id: string;
  exercise_id: string;
  position: number;
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
  superset_group_id: string | null;
  superset_cycle: number | null;
  side: SetSide | null;
  duration_seconds: number | null; // cardio: session length, in place of reps/weight
  notes: string | null; // cardio: intensity/style (incline, resistance, etc.)
  calories: number | null; // cardio: calories burned
  distance_miles: number | null; // cardio: distance covered, in miles
}

// A rotating group of 2-3 exercises alternated between sets, with a short
// rest between exercises and a longer rest after completing a full cycle.
export interface SupersetGroup {
  id: string;
  session_id: string;
  user_id: string;
}

export interface SupersetGroupExercise {
  group_id: string;
  exercise_id: string;
  position: number;
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
