import { describe, expect, it } from "vitest";
import { predictNextMuscleGroup } from "@/lib/rotation";
import type { OrderedMuscleGroup, WorkoutSession } from "@/lib/types";

const legs: OrderedMuscleGroup = { id: "legs", name: "Legs", sort_order: 0 };
const chest: OrderedMuscleGroup = { id: "chest", name: "Chest", sort_order: 1 };
const shoulders: OrderedMuscleGroup = { id: "shoulders", name: "Shoulders", sort_order: 2 };
const groups = [chest, shoulders, legs]; // intentionally out of sort_order

function sessionFor(muscleGroupId: string): WorkoutSession {
  return {
    id: "session-1",
    user_id: "user-1",
    muscle_group_id: muscleGroupId,
    template_id: null,
    started_at: "2026-01-01T00:00:00.000Z",
    ended_at: "2026-01-01T01:00:00.000Z",
    time_budget_minutes: null,
  };
}

describe("predictNextMuscleGroup", () => {
  it("defaults to the first group in sort_order when there is no history", () => {
    expect(predictNextMuscleGroup(groups, null)).toEqual(legs);
  });

  it("returns the next group in sort_order after the last completed session", () => {
    expect(predictNextMuscleGroup(groups, sessionFor("legs"))).toEqual(chest);
  });

  it("wraps around from the last group back to the first", () => {
    expect(predictNextMuscleGroup(groups, sessionFor("shoulders"))).toEqual(legs);
  });

  it("falls back to the first group when the last session's muscle group no longer exists", () => {
    expect(predictNextMuscleGroup(groups, sessionFor("deleted-group"))).toEqual(legs);
  });
});
