import { describe, expect, it } from "vitest";
import {
  computeDifficultyBreakdown,
  computeDurationMinutes,
  computeMuscleGroupFreshness,
  computeSessionsPerWeek,
  computeSessionSummary,
  computeTotalCalories,
  computeVariantSplit,
  computeWeeklyCalories,
  computeWeeklyVolume,
  isoWeekStart,
} from "@/lib/metrics";

describe("isoWeekStart", () => {
  it("returns the Monday of the containing ISO week, for both string and Date input", () => {
    expect(isoWeekStart("2026-06-03T15:00:00Z")).toBe("2026-06-01"); // Wednesday -> that week's Monday
    expect(isoWeekStart(new Date("2026-06-01T00:00:00Z"))).toBe("2026-06-01"); // Monday -> itself
  });
});

describe("computeWeeklyVolume", () => {
  it("sums weight × reps per muscle group within the same ISO week", () => {
    const result = computeWeeklyVolume([
      { weight: 100, actual_reps: 10, logged_at: "2026-06-01T10:00:00Z", muscle_group_id: "legs" }, // Monday
      { weight: 50, actual_reps: 10, logged_at: "2026-06-03T10:00:00Z", muscle_group_id: "legs" }, // same week
      { weight: 20, actual_reps: 15, logged_at: "2026-06-01T10:00:00Z", muscle_group_id: "chest" },
    ]);
    expect(result).toEqual([
      { weekStart: "2026-06-01", muscleGroupId: "legs", volume: 1500 },
      { weekStart: "2026-06-01", muscleGroupId: "chest", volume: 300 },
    ]);
  });

  it("separates sets that fall into different ISO weeks", () => {
    const result = computeWeeklyVolume([
      { weight: 100, actual_reps: 10, logged_at: "2026-06-01T10:00:00Z", muscle_group_id: "legs" },
      { weight: 100, actual_reps: 10, logged_at: "2026-06-08T10:00:00Z", muscle_group_id: "legs" },
    ]);
    expect(result.map((r) => r.weekStart)).toEqual(["2026-06-01", "2026-06-08"]);
  });

  it("skips sets with no weight or rep count logged", () => {
    const result = computeWeeklyVolume([
      { weight: null, actual_reps: 10, logged_at: "2026-06-01T10:00:00Z", muscle_group_id: "legs" },
      { weight: 100, actual_reps: null, logged_at: "2026-06-01T10:00:00Z", muscle_group_id: "legs" },
    ]);
    expect(result).toEqual([]);
  });
});

describe("computeDifficultyBreakdown", () => {
  it("counts sets per difficulty and excludes unrated sets", () => {
    const result = computeDifficultyBreakdown([
      { difficulty: "easy" },
      { difficulty: "easy" },
      { difficulty: "failed" },
      { difficulty: null },
    ]);
    expect(result).toEqual([
      { difficulty: "easy", count: 2 },
      { difficulty: "failed", count: 1 },
    ]);
  });
});

describe("computeVariantSplit", () => {
  it("counts sets per training variant", () => {
    const result = computeVariantSplit([
      { training_variant: "standard" },
      { training_variant: "tut" },
      { training_variant: "standard" },
    ]);
    expect(result).toEqual([
      { variant: "standard", count: 2 },
      { variant: "tut", count: 1 },
    ]);
  });
});

describe("computeMuscleGroupFreshness", () => {
  const now = new Date("2026-07-10T00:00:00Z");

  it("reports days since the most recently logged set per muscle group", () => {
    const result = computeMuscleGroupFreshness(
      [
        { muscle_group_id: "legs", logged_at: "2026-07-05T00:00:00Z" },
        { muscle_group_id: "legs", logged_at: "2026-07-08T00:00:00Z" },
      ],
      ["legs", "chest"],
      now
    );
    expect(result).toEqual([
      { muscleGroupId: "legs", daysSinceLastTrained: 2 },
      { muscleGroupId: "chest", daysSinceLastTrained: null },
    ]);
  });

  it("returns null for muscle groups with no logged sets", () => {
    const result = computeMuscleGroupFreshness(
      [{ muscle_group_id: "legs", logged_at: "2026-07-09T00:00:00Z" }],
      ["legs", "back"],
      now
    );
    expect(result).toEqual([
      { muscleGroupId: "legs", daysSinceLastTrained: 1 },
      { muscleGroupId: "back", daysSinceLastTrained: null },
    ]);
  });
});

describe("computeSessionsPerWeek", () => {
  it("counts completed sessions per ISO week", () => {
    const result = computeSessionsPerWeek([
      { started_at: "2026-06-01T00:00:00Z", ended_at: "2026-06-01T01:00:00Z" },
      { started_at: "2026-06-03T00:00:00Z", ended_at: "2026-06-03T01:00:00Z" },
      { started_at: "2026-06-08T00:00:00Z", ended_at: "2026-06-08T01:00:00Z" },
      { started_at: "2026-06-09T00:00:00Z", ended_at: null },
    ]);
    expect(result).toEqual([
      { weekStart: "2026-06-01", count: 2 },
      { weekStart: "2026-06-08", count: 1 },
    ]);
  });
});

describe("computeWeeklyCalories", () => {
  it("sums calories per ISO week, skipping sets with no calories logged", () => {
    const result = computeWeeklyCalories([
      { calories: 200, logged_at: "2026-06-01T10:00:00Z" },
      { calories: 150, logged_at: "2026-06-03T10:00:00Z" },
      { calories: null, logged_at: "2026-06-03T11:00:00Z" },
      { calories: 300, logged_at: "2026-06-08T10:00:00Z" },
    ]);
    expect(result).toEqual([
      { weekStart: "2026-06-01", calories: 350 },
      { weekStart: "2026-06-08", calories: 300 },
    ]);
  });

  it("returns an empty array when no sets have calories", () => {
    expect(computeWeeklyCalories([{ calories: null, logged_at: "2026-06-01T10:00:00Z" }])).toEqual([]);
  });
});

describe("computeTotalCalories", () => {
  it("sums calories across all sets, treating missing values as zero", () => {
    expect(computeTotalCalories([{ calories: 200 }, { calories: null }, { calories: 150 }])).toBe(350);
  });

  it("returns 0 for an empty list", () => {
    expect(computeTotalCalories([])).toBe(0);
  });
});

describe("computeDurationMinutes", () => {
  it("returns whole minutes between two timestamps", () => {
    expect(computeDurationMinutes("2026-07-05T10:00:00Z", "2026-07-05T10:42:30Z")).toBe(43);
  });

  it("floors at 0 for an end time before the start", () => {
    expect(computeDurationMinutes("2026-07-05T10:00:00Z", "2026-07-05T09:00:00Z")).toBe(0);
  });
});

describe("computeSessionSummary", () => {
  const exerciseInfo = new Map([
    ["bench", { name: "Barbell Bench Press", isCardio: false }],
    ["row", { name: "Barbell Row", isCardio: false }],
    ["elliptical", { name: "Elliptical", isCardio: true }],
  ]);

  it("rolls up per-exercise volume, top weight, and totals", () => {
    const result = computeSessionSummary(
      [
        { exercise_id: "bench", weight: 135, actual_reps: 10, duration_seconds: null },
        { exercise_id: "bench", weight: 145, actual_reps: 8, duration_seconds: null },
        { exercise_id: "row", weight: 95, actual_reps: 10, duration_seconds: null },
      ],
      exerciseInfo,
      new Map()
    );
    expect(result.totalSets).toBe(3);
    expect(result.totalVolume).toBe(135 * 10 + 145 * 8 + 95 * 10);
    const bench = result.exercises.find((e) => e.exerciseId === "bench")!;
    expect(bench.setCount).toBe(2);
    expect(bench.topWeight).toBe(145);
    expect(bench.volume).toBe(135 * 10 + 145 * 8);
  });

  it("flags a PR when this session's top weight beats prior history", () => {
    const result = computeSessionSummary(
      [{ exercise_id: "bench", weight: 150, actual_reps: 5, duration_seconds: null }],
      exerciseInfo,
      new Map([["bench", 145]])
    );
    expect(result.exercises[0].isPR).toBe(true);
    expect(result.prCount).toBe(1);
  });

  it("does not flag a PR when this session's top weight doesn't beat prior history", () => {
    const result = computeSessionSummary(
      [{ exercise_id: "bench", weight: 140, actual_reps: 5, duration_seconds: null }],
      exerciseInfo,
      new Map([["bench", 145]])
    );
    expect(result.exercises[0].isPR).toBe(false);
    expect(result.prCount).toBe(0);
  });

  it("treats a first-ever set (no prior history) as a PR", () => {
    const result = computeSessionSummary(
      [{ exercise_id: "bench", weight: 95, actual_reps: 10, duration_seconds: null }],
      exerciseInfo,
      new Map()
    );
    expect(result.exercises[0].isPR).toBe(true);
  });

  it("never flags cardio as a PR and tracks duration instead of volume", () => {
    const result = computeSessionSummary(
      [{ exercise_id: "elliptical", weight: null, actual_reps: null, duration_seconds: 1200 }],
      exerciseInfo,
      new Map()
    );
    const elliptical = result.exercises[0];
    expect(elliptical.isPR).toBe(false);
    expect(elliptical.volume).toBe(0);
    expect(elliptical.totalDurationSeconds).toBe(1200);
  });
});
