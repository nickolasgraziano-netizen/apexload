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
export const GENERIC_MESSAGES = [
  "Be water, my friend. — Bruce Lee",
  "Adapt what is useful, reject what is useless, and add what is specifically your own. — Bruce Lee",
  "Notice that the stiffest tree is most easily cracked, while the bamboo or willow survives by bending with the wind. — Bruce Lee",
  "Obey the principles without being bound by them. — Bruce Lee",
  "Do not pray for an easy life, pray for the strength to endure a difficult one. — Bruce Lee",
  "I fear not the man who has practiced 10,000 kicks once, but I fear the man who has practiced one kick 10,000 times. — Bruce Lee",
  "The successful warrior is the average man, with laser-like focus. — Bruce Lee",
  "As you think, so shall you become. — Bruce Lee",
  "Knowing is not enough; we must apply. Willing is not enough; we must do. — Bruce Lee",
  "It is not a daily increase, but a daily decrease. Hack away at the unessential. — Bruce Lee",
  "Always be yourself, express yourself, have faith in yourself, do not go out and look for a successful personality and duplicate it. — Bruce Lee",
  "Mistakes are always forgivable, if one has the courage to admit them. — Bruce Lee",
  "Knowledge will give you power, but character respect. — Bruce Lee",
  "I'm not in this world to live up to your expectations and you're not in this world to live up to mine. — Bruce Lee",
  "Don't fear failure. Not failure, but low aim, is the crime. In great attempts it is glorious even to fail. — Bruce Lee",
  "If you spend too much time thinking about a thing, you'll never get it done. — Bruce Lee",
  "To hell with circumstances; I create opportunities. — Bruce Lee",
  "If you love life, don't waste time, for time is what life is made up of. — Bruce Lee",
  "The key to immortality is first living a life worth remembering. — Bruce Lee",
  "A wise man can learn more from a foolish question than a fool can learn from a wise answer. — Bruce Lee",
  "Using no way as way; having no limitation as limitation. — Bruce Lee",
  "To change with change is the changeless state. — Bruce Lee",
  "The meaning of life is that it is to be lived. — Bruce Lee",
  "Don't think. Feel. — Bruce Lee",
  "Life itself is your teacher, and you are in a state of constant learning. — Bruce Lee",
  "A goal is not always meant to be reached; it often serves simply as something to aim at. — Bruce Lee",
  "Preparation for tomorrow is hard work today. — Bruce Lee",
  "Showing off is the fool's idea of glory. — Bruce Lee",
  "Simplicity is the key to brilliance. — Bruce Lee",
  "The less effort, the faster and more powerful you will be. — Bruce Lee",
  "Take things as they are. Punch when you have to punch. Kick when you have to kick. — Bruce Lee",
  "Real living is living for others. — Bruce Lee",
  "Only the self-sufficient stand alone; most people follow the crowd and imitate. — Bruce Lee",
  "Defeat is a state of mind; no one is ever defeated until defeat has been accepted as a reality. — Bruce Lee",
  "Practice makes perfect. After a long time of practicing, our work will become natural, skillful, swift, and steady. — Bruce Lee",
  "Art calls for complete mastery of techniques, developed by reflection within the soul. — Bruce Lee",
  "Choose the positive. You have choice; you are master of your attitude. — Bruce Lee",
  "What you habitually think largely determines what you will ultimately become. — Bruce Lee",
  "It's not what you give, it's how you give it. — Bruce Lee",
  "I am actualizing myself daily to be an Artist of Life. — Bruce Lee",
];

export function shuffleMessages(messages: string[] = GENERIC_MESSAGES): string[] {
  const shuffled = [...messages];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Picks a random quote from the pool as a server-safe fallback. Client quote
 * moments use a session queue so the journey avoids repeats. */
export function pickGenericMessage(): string {
  return GENERIC_MESSAGES[Math.floor(Math.random() * GENERIC_MESSAGES.length)];
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
}): string {
  const { latestPR, sessionsThisWeek, targetPerWeek } = opts;

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
  return pickGenericMessage();
}
