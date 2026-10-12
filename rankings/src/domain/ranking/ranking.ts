/** One match as the ranking calculation sees it. */
export type RankingMatch = { winnerId: string; loserId: string; playedAt: Date };

export type RankingOptions = {
  /** Every contestant in the scope; matches involving anyone else are ignored. */
  contestantIds: readonly string[];
  /** Matches lose half their weight every this many days; null weighs every match equally forever. */
  halfLifeDays: number | null;
  now: Date;
};

export type RankedContestant = {
  contestantId: string;
  /** Best guess of strength on a logistic scale centred on 1500, where 400 points means 10-to-1 odds. */
  rating: number;
  /** Half-width of the rating's confidence range (rating ± range). */
  range: number;
  /** rating − range: what rankings order by, so unproven contestants must earn their place. */
  score: number;
  wins: number;
  losses: number;
  matches: number;
};

export type Ranking = {
  /** Contestants with at least one match, highest score first. */
  ranked: RankedContestant[];
  /** Contestants in the scope with no matches, in the order given. */
  notYetJudged: string[];
};

const RATING_SCALE = 400 / Math.LN10;
const MAX_ITERATIONS = 500;
const TOLERANCE = 1e-9;

type Opponent = { index: number; won: number; total: number };

/**
 * Bradley–Terry fit by minorization–maximization over sparse pair counts. Each contestant also gets
 * one virtual win and one virtual loss against a phantom of strength 1, which anchors the scale and
 * keeps contestants with few matches near the middle.
 */
export function calculateRanking(matches: readonly RankingMatch[], options: RankingOptions): Ranking {
  const indexOf = new Map(options.contestantIds.map((id, i) => [id, i]));
  const n = options.contestantIds.length;
  const wins = new Array<number>(n).fill(0);
  const losses = new Array<number>(n).fill(0);
  // pairs.get(lowIndex * n + highIndex) = [faded wins of low over high, faded wins of high over low]
  const pairs = new Map<number, [number, number]>();

  for (const m of matches) {
    const w = indexOf.get(m.winnerId);
    const l = indexOf.get(m.loserId);
    if (w === undefined || l === undefined || w === l) continue;
    wins[w]++;
    losses[l]++;
    const weight = matchWeight(m.playedAt, options);
    const key = w < l ? w * n + l : l * n + w;
    const pair = pairs.get(key) ?? [0, 0];
    pair[w < l ? 0 : 1] += weight;
    pairs.set(key, pair);
  }

  const opponents: Opponent[][] = Array.from({ length: n }, () => []);
  const fadedWins = new Array<number>(n).fill(0);
  for (const [key, [lowWon, highWon]] of pairs) {
    const low = Math.floor(key / n);
    const high = key % n;
    const total = lowWon + highWon;
    opponents[low].push({ index: high, won: lowWon, total });
    opponents[high].push({ index: low, won: highWon, total });
    fadedWins[low] += lowWon;
    fadedWins[high] += highWon;
  }

  let p = new Array<number>(n).fill(1);
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let maxChange = 0;
    const next = p.map((pi, i) => {
      let den = 2 / (pi + 1);
      for (const o of opponents[i]) den += o.total / (pi + p[o.index]);
      const updated = (1 + fadedWins[i]) / den;
      maxChange = Math.max(maxChange, Math.abs(Math.log(updated / pi)));
      return updated;
    });
    p = next;
    if (maxChange < TOLERANCE) break;
  }

  const ranked: RankedContestant[] = [];
  const notYetJudged: string[] = [];
  options.contestantIds.forEach((contestantId, i) => {
    const played = wins[i] + losses[i];
    if (played === 0) {
      notYetJudged.push(contestantId);
      return;
    }
    let information = (2 * p[i]) / (p[i] + 1) ** 2;
    for (const o of opponents[i]) information += (o.total * p[i] * p[o.index]) / (p[i] + p[o.index]) ** 2;
    const rating = 1500 + RATING_SCALE * Math.log(p[i]);
    const range = (2 * RATING_SCALE) / Math.sqrt(information);
    ranked.push({ contestantId, rating, range, score: rating - range, wins: wins[i], losses: losses[i], matches: played });
  });
  ranked.sort((a, b) => b.score - a.score);
  return { ranked, notYetJudged };
}

function matchWeight(playedAt: Date, { halfLifeDays, now }: RankingOptions): number {
  if (halfLifeDays === null) return 1;
  const ageDays = Math.max(0, now.getTime() - playedAt.getTime()) / (24 * 60 * 60 * 1000);
  return 0.5 ** (ageDays / halfLifeDays);
}
