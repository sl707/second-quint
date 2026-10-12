/** A first-round position in the bracket: a contestant ID, or null for a bye. */
export type Slot = string | null;

export type Random = () => number;

function shuffle<T>(items: readonly T[], random: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function bracketSizeFor(contestants: number): number {
  let size = 2;
  while (size < contestants) size *= 2;
  return size;
}

/**
 * Draws `size` contestants at random from the scope and places them at random in a bracket of the
 * next power of two. Byes go to random first-round matches, never two in the same match.
 */
export function drawBracket(scope: readonly string[], size: number, random: Random = Math.random): Slot[] {
  if (!Number.isInteger(size) || size < 4 || size > scope.length) {
    throw new Error(`A tournament size must be from 4 to ${scope.length}`);
  }
  const drawn = shuffle(scope, random).slice(0, size);
  const bracketSize = bracketSizeFor(size);
  const byeMatches = new Set(shuffle([...Array(bracketSize / 2).keys()], random).slice(0, bracketSize - size));

  const slots: Slot[] = [];
  let next = 0;
  for (let match = 0; match < bracketSize / 2; match++) {
    if (byeMatches.has(match)) {
      const contestant = drawn[next++];
      slots.push(...(random() < 0.5 ? [contestant, null] : [null, contestant]));
    } else {
      slots.push(drawn[next++], drawn[next++]);
    }
  }
  return slots;
}

export type Pick = { winnerId: string; loserId: string };

/** One match of the bracket. A null contestant is a bye in a bye match, otherwise not yet known. */
export type BracketMatch = {
  round: number;
  contestantIds: [string | null, string | null];
  winnerId: string | null;
  bye: boolean;
};

export type NextMatch = {
  /** Position in play order, from 0; equals the number of matches already played. */
  index: number;
  round: number;
  thirdPlace: boolean;
  contestantIds: [string, string];
};

export type TournamentRankingTier = { place: string; contestantIds: string[] };

export type BracketState = {
  /** rounds[0] is the first round, including bye matches; the last round holds the final. */
  rounds: BracketMatch[][];
  thirdPlace: BracketMatch | null;
  next: NextMatch | null;
  matchesPlayed: number;
  matchesLeft: number;
  finished: boolean;
  ranking: TournamentRankingTier[] | null;
};

function loserOf(match: BracketMatch): string | null {
  if (match.bye || !match.winnerId) return null;
  return match.contestantIds[0] === match.winnerId ? match.contestantIds[1] : match.contestantIds[0];
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
}

/**
 * Replays picks, in play order, through the bracket: each round's matches in bracket order, with the
 * third-place match just before the final. Throws if a pick isn't for the match it would decide.
 */
export function playBracket(slots: readonly Slot[], picks: readonly Pick[]): BracketState {
  const roundCount = Math.log2(slots.length);
  if (!Number.isInteger(roundCount) || roundCount < 2) throw new Error("A bracket needs 4, 8, 16, … slots");

  const rounds: BracketMatch[][] = [];
  let thirdPlace: BracketMatch | null = null;
  let next: NextMatch | null = null;
  let played = 0;
  let total = 0;

  const decide = (match: BracketMatch, isThirdPlace: boolean) => {
    if (match.bye) return;
    total++;
    const [a, b] = match.contestantIds;
    if (next || a === null || b === null) return;
    const pick = picks[played];
    if (!pick) {
      next = { index: played, round: match.round, thirdPlace: isThirdPlace, contestantIds: [a, b] };
      return;
    }
    const valid = (pick.winnerId === a && pick.loserId === b) || (pick.winnerId === b && pick.loserId === a);
    if (!valid) throw new Error(`Pick ${played + 1} is not for the match between ${a} and ${b}`);
    match.winnerId = pick.winnerId;
    played++;
  };

  for (let r = 0; r < roundCount; r++) {
    const round: BracketMatch[] = [];
    for (let m = 0; m < slots.length / 2 ** (r + 1); m++) {
      if (r === 0) {
        const [a, b] = [slots[2 * m], slots[2 * m + 1]];
        const bye = a === null || b === null;
        round.push({ round: 1, contestantIds: [a, b], winnerId: bye ? (a ?? b) : null, bye });
      } else {
        const [left, right] = [rounds[r - 1][2 * m], rounds[r - 1][2 * m + 1]];
        round.push({ round: r + 1, contestantIds: [left.winnerId, right.winnerId], winnerId: null, bye: false });
      }
    }
    rounds.push(round);

    if (r === roundCount - 1) {
      const semifinals = rounds[r - 1];
      if (semifinals.every((match) => !match.bye)) {
        thirdPlace = { round: r + 1, contestantIds: [loserOf(semifinals[0]), loserOf(semifinals[1])], winnerId: null, bye: false };
        decide(thirdPlace, true);
      }
    }
    for (const match of round) decide(match, false);
  }

  if (played < picks.length) throw new Error("More picks than matches in this bracket");

  const finished = played === total;
  return {
    rounds,
    thirdPlace,
    next,
    matchesPlayed: played,
    matchesLeft: total - played,
    finished,
    ranking: finished ? rankBracket(rounds, thirdPlace) : null,
  };
}

function rankBracket(rounds: BracketMatch[][], thirdPlace: BracketMatch | null): TournamentRankingTier[] {
  const tiers: string[][] = [];
  const final = rounds[rounds.length - 1][0];
  tiers.push([final.winnerId!], [loserOf(final)!]);
  if (thirdPlace) tiers.push([thirdPlace.winnerId!], [loserOf(thirdPlace)!]);
  for (let r = rounds.length - (thirdPlace ? 3 : 2); r >= 0; r--) {
    const losers = rounds[r].map(loserOf).filter((id): id is string => id !== null);
    if (losers.length) tiers.push(losers);
  }

  let placed = 0;
  return tiers.map((contestantIds) => {
    const first = placed + 1;
    placed += contestantIds.length;
    const place = contestantIds.length === 1 ? ordinal(first) : `${ordinal(first)}–${ordinal(placed)}`;
    return { place, contestantIds };
  });
}
