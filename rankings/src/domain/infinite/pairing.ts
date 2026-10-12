import type { Random } from "@/domain/tournament/bracket";

/** A contestant in the scope, with its latest global rating and match count. */
export type PairingCandidate = { id: string; rating: number; matches: number };

/**
 * How sharply the second contestant favors a close rating, per rating point. At 0.01 a contestant
 * 100 points away weighs about a third of an equal one, and the 0.1 floor keeps far pairs coming,
 * so roughly half the pairs are close and the rest varied.
 */
export const RATING_CLOSENESS = 0.01;

/** The fewest contestants a scope needs for Infinite Mode. */
export const INFINITE_MODE_MIN_SCOPE = 2;

/** The rating given to a contestant no global ranking has judged yet (the scale's center). */
export const UNJUDGED_RATING = 1500;

function fewMatchesBoost(c: PairingCandidate) {
  return 1 + 3 / (1 + c.matches);
}

function weightedPick(weights: readonly number[], random: Random): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0 && weights[i] > 0) return i;
  }
  return weights.findLastIndex((w) => w > 0);
}

/**
 * Picks an Infinite Mode pair: the first contestant favors few matches, the second also favors a
 * rating close to the first's, with randomness so pairs aren't scripted.
 */
export function pickInfinitePair(candidates: readonly PairingCandidate[], random: Random): [string, string] {
  if (candidates.length < INFINITE_MODE_MIN_SCOPE) throw new Error("Infinite Mode needs at least 2 contestants.");
  const a = weightedPick(candidates.map(fewMatchesBoost), random);
  const ratingA = candidates[a].rating;
  const b = weightedPick(
    candidates.map((c, i) =>
      i === a ? 0 : fewMatchesBoost(c) * (Math.exp(-RATING_CLOSENESS * Math.abs(c.rating - ratingA)) + 0.1),
    ),
    random,
  );
  return [candidates[a].id, candidates[b].id];
}
