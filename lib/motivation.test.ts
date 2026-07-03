import { describe, expect, it } from "vitest";
import {
  buildMotivationalMessage,
  findLatestPR,
  firstNameFrom,
  pickGenericMessage,
} from "@/lib/motivation";

describe("firstNameFrom", () => {
  it("returns the first word of a full name", () => {
    expect(firstNameFrom("Nick Graziano")).toBe("Nick");
  });

  it("falls back to the email local-part when no name is on file", () => {
    expect(firstNameFrom("nick@example.com")).toBe("nick");
  });

  it("falls back to a generic greeting when there's nothing to work with", () => {
    expect(firstNameFrom(null)).toBe("there");
    expect(firstNameFrom("")).toBe("there");
  });
});

describe("pickGenericMessage", () => {
  it("is deterministic for the same seed", () => {
    expect(pickGenericMessage(3)).toBe(pickGenericMessage(3));
  });

  it("handles negative seeds without throwing", () => {
    expect(() => pickGenericMessage(-1)).not.toThrow();
  });
});

describe("findLatestPR", () => {
  it("returns the exercise when the most recent set beats all prior sets for it", () => {
    const result = findLatestPR([
      { exerciseId: "curl", exerciseName: "Hammer Curl", weight: 30, loggedAt: "2026-07-01T10:00:00Z" },
      { exerciseId: "curl", exerciseName: "Hammer Curl", weight: 35, loggedAt: "2026-07-08T10:00:00Z" },
    ]);
    expect(result).toEqual({ exerciseName: "Hammer Curl", weight: 35 });
  });

  it("returns null when the most recent set does not beat the prior max", () => {
    const result = findLatestPR([
      { exerciseId: "curl", exerciseName: "Hammer Curl", weight: 35, loggedAt: "2026-07-01T10:00:00Z" },
      { exerciseId: "curl", exerciseName: "Hammer Curl", weight: 30, loggedAt: "2026-07-08T10:00:00Z" },
    ]);
    expect(result).toBeNull();
  });

  it("only compares against sets of the same exercise", () => {
    const result = findLatestPR([
      { exerciseId: "squat", exerciseName: "Squat", weight: 200, loggedAt: "2026-07-01T10:00:00Z" },
      { exerciseId: "curl", exerciseName: "Hammer Curl", weight: 20, loggedAt: "2026-07-08T10:00:00Z" },
    ]);
    expect(result).toEqual({ exerciseName: "Hammer Curl", weight: 20 });
  });

  it("returns null for an empty set list", () => {
    expect(findLatestPR([])).toBeNull();
  });
});

describe("buildMotivationalMessage", () => {
  it("prioritizes a recent PR over everything else", () => {
    const result = buildMotivationalMessage({
      latestPR: { exerciseName: "Squat", weight: 225 },
      sessionsThisWeek: 5,
      targetPerWeek: 5,
    });
    expect(result).toContain("Squat");
    expect(result).toContain("225");
  });

  it("falls back to a consistency message when there's no PR", () => {
    const result = buildMotivationalMessage({ sessionsThisWeek: 2, targetPerWeek: 5 });
    expect(result).toContain("2 of 5 sessions");
  });

  it("falls back to a generic message when there's no PR or session data", () => {
    const result = buildMotivationalMessage({ seed: 0 });
    expect(result).toBe(pickGenericMessage(0));
  });
});
