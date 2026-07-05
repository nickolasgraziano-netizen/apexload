/**
 * Derives a display-friendly first name from a profile's display_name.
 * Falls back to the local part of an email if no real name is on file yet
 * (matches the pre-existing "email prefix" greeting behavior).
 */
export function firstNameFrom(displayName: string | null | undefined): string {
  if (!displayName) return "there";
  if (displayName.includes("@")) return displayName.split("@")[0];
  return displayName.trim().split(/\s+/)[0] || "there";
}

// Real Bruce Lee quotes, used as the generic-encouragement fallback when
// there's no PR or weekly-consistency signal to show instead.
const GENERIC_MESSAGES = [
  "Be water, my friend. — Bruce Lee",
  "I fear not the man who has practiced 10,000 kicks once, but I fear the man who has practiced one kick 10,000 times. — Bruce Lee",
  "A goal is not always meant to be reached, it often serves simply as something to aim at. — Bruce Lee",
  "The successful warrior is the average man, with laser-like focus. — Bruce Lee",
  "Do not pray for an easy life, pray for the strength to endure a difficult one. — Bruce Lee",
  "Notice that the stiffest tree is most easily cracked, while the bamboo or willow survives by bending with the wind. — Bruce Lee",
  "As you think, so shall you become. — Bruce Lee",
  "There are no limits. There are only plateaus, and you must not stay there, you must go beyond them. — Bruce Lee",
  "Absorb what is useful, discard what is useless and add what is specifically your own. — Bruce Lee",
  "The key to immortality is first living a life worth remembering. — Bruce Lee",
];

/** Deterministic pick from the generic pool, so server and client agree. */
export function pickGenericMessage(seed: number): string {
  const i = ((seed % GENERIC_MESSAGES.length) + GENERIC_MESSAGES.length) % GENERIC_MESSAGES.length;
  return GENERIC_MESSAGES[i];
}

export interface PRCandidate {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  loggedAt: string;
}

export interface RecentPR {
  exerciseName: string;
  weight: number;
}

/**
 * Whether the most recently logged set (by loggedAt) is a new max weight
 * for its exercise. Only the latest set is checked — this is meant to
 * answer "did you just PR?", not to enumerate PR history.
 */
export function findLatestPR(sets: PRCandidate[]): RecentPR | null {
  if (sets.length === 0) return null;
  const latest = [...sets].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))[0];
  const priorMax = Math.max(
    0,
    ...sets
      .filter((s) => s.exerciseId === latest.exerciseId && s.loggedAt !== latest.loggedAt)
      .map((s) => s.weight)
  );
  if (latest.weight > priorMax) {
    return { exerciseName: latest.exerciseName, weight: latest.weight };
  }
  return null;
}

/**
 * A single motivational line, prioritizing a real signal (a just-hit PR,
 * then this week's consistency) over generic encouragement.
 */
export function buildMotivationalMessage(opts: {
  latestPR?: RecentPR | null;
  sessionsThisWeek?: number;
  targetPerWeek?: number;
  seed?: number;
}): string {
  const { latestPR, sessionsThisWeek, targetPerWeek, seed = 0 } = opts;

  if (latestPR) {
    return `New PR: ${latestPR.exerciseName} at ${latestPR.weight} lb.`;
  }
  if (sessionsThisWeek != null && targetPerWeek != null) {
    if (sessionsThisWeek >= targetPerWeek) {
      return `${sessionsThisWeek} sessions this week — on pace for your ${targetPerWeek}-day split.`;
    }
    if (sessionsThisWeek > 0) {
      return `${sessionsThisWeek} of ${targetPerWeek} sessions this week. Keep going.`;
    }
  }
  return pickGenericMessage(seed);
}
