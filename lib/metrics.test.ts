import { describe, expect, it } from "vitest";
import {
  computeDifficultyBreakdown,
  computeMuscleGroupFreshness,
  computeSessionsPerWeek,
  computeVariantSplit,
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
