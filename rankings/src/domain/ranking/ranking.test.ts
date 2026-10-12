import { describe, expect, it } from "vitest";
import { calculateRanking, type RankingMatch } from "./ranking";

const NOW = new Date("2026-10-11T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY);
}

function match(winnerId: string, loserId: string, playedAt: Date = NOW): RankingMatch {
  return { winnerId, loserId, playedAt };
}

describe("calculateRanking", () => {
  it("puts a single match on the Elo-like scale, with score at the low end of the range", () => {
    // Worked by hand: the fit solves 1 = 2/(1+p) + 1/(1+p²) for the winner, p ≈ 1.6956, and the
    // loser gets 1/p. Rating = 1500 + 173.7·ln p, range = 2·173.7 / sqrt(information).
    const ranking = calculateRanking([match("a", "b")], { contestantIds: ["a", "b"], halfLifeDays: null, now: NOW });

    const [a, b] = ranking.ranked;
    expect(a).toMatchObject({ contestantId: "a", wins: 1, losses: 0, matches: 1 });
    expect(a.rating).toBeCloseTo(1591.7, 0);
    expect(a.range).toBeCloseTo(428.2, 0);
    expect(a.score).toBeCloseTo(a.rating - a.range, 6);
    expect(b).toMatchObject({ contestantId: "b", wins: 0, losses: 1, matches: 1 });
    expect(b.rating).toBeCloseTo(1408.3, 0);
    expect(b.range).toBeCloseTo(428.2, 0);
  });

  it("lets a strong newcomer rise, but not jump to #1 on two lucky wins", () => {
    const established = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"];
    const month: RankingMatch[] = [];
    for (let day = 30; day >= 1; day--) {
      for (let i = 0; i < established.length; i++) {
        for (let j = i + 1; j < established.length; j++) {
          // The stronger contestant (lower number) usually wins; one match in four is an upset.
          const upset = (day + i + j) % 4 === 0;
          month.push(match(upset ? established[j] : established[i], upset ? established[i] : established[j], daysAgo(day)));
        }
      }
    }
    const contestantIds = [...established, "newcomer"];
    const rank = (matches: RankingMatch[]) =>
      calculateRanking(matches, { contestantIds, halfLifeDays: 30, now: NOW }).ranked.map((r) => r.contestantId);

    const afterTwoWins = rank([...month, match("newcomer", "c4"), match("newcomer", "c5")]);
    expect(afterTwoWins).toContain("newcomer");
    expect(afterTwoWins[0]).toBe("c1");

    const afterAWeek = [...month];
    for (let day = 7; day >= 1; day--) for (const c of established) afterAWeek.push(match("newcomer", c, daysAgo(day - 0.5)));
    expect(rank(afterAWeek)[0]).toBe("newcomer");
  });

  it("values strength of opponents over raw win rate across a strong and a weak category", () => {
    const strong = ["s1", "s2", "s3", "s4"];
    const weak = ["w1", "w2", "w3", "w4"];
    const matches: RankingMatch[] = [];
    const roundRobin = (members: string[], day: number) => {
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const upset = i > 0 && (day + i + j) % 3 === 0;
          matches.push(match(upset ? members[j] : members[i], upset ? members[i] : members[j], daysAgo(day)));
        }
      }
    };
    for (let day = 14; day >= 1; day--) {
      roundRobin(strong, day);
      roundRobin(weak, day);
      // A little cross-category play, which the strong category always wins.
      matches.push(match(strong[day % 4], weak[(day + 1) % 4], daysAgo(day)));
    }

    const { ranked } = calculateRanking(matches, { contestantIds: [...strong, ...weak], halfLifeDays: 30, now: NOW });
    const s3 = ranked.find((r) => r.contestantId === "s3")!;
    const w1 = ranked.find((r) => r.contestantId === "w1")!;

    expect(w1.wins / w1.matches).toBeGreaterThan(s3.wins / s3.matches);
    expect(ranked.indexOf(s3)).toBeLessThan(ranked.indexOf(w1));
  });

  it("fades old matches so the ranking follows a change in taste", () => {
    const matches: RankingMatch[] = [];
    for (let i = 0; i < 10; i++) matches.push(match("old-favorite", "new-favorite", daysAgo(120 + i)));
    for (let i = 0; i < 5; i++) matches.push(match("new-favorite", "old-favorite", daysAgo(1 + i)));
    const contestantIds = ["old-favorite", "new-favorite"];

    const faded = calculateRanking(matches, { contestantIds, halfLifeDays: 30, now: NOW });
    expect(faded.ranked.map((r) => r.contestantId)).toEqual(["new-favorite", "old-favorite"]);

    const unfaded = calculateRanking(matches, { contestantIds, halfLifeDays: null, now: NOW });
    expect(unfaded.ranked.map((r) => r.contestantId)).toEqual(["old-favorite", "new-favorite"]);
    expect(unfaded.ranked[0]).toMatchObject({ wins: 10, losses: 5, matches: 15 });
  });

  it("without fading, as personal rankings use, weighs a year-old match exactly like today's", () => {
    const options = { contestantIds: ["a", "b", "c"], halfLifeDays: null, now: NOW };
    const recent = calculateRanking([match("a", "b"), match("b", "c"), match("c", "a"), match("a", "c")], options);
    const aged = calculateRanking(
      [match("a", "b", daysAgo(365)), match("b", "c"), match("c", "a", daysAgo(400)), match("a", "c")],
      options,
    );

    expect(aged).toEqual(recent);
  });

  it("lists contestants in the scope with no matches as not yet judged", () => {
    const ranking = calculateRanking([match("a", "b"), match("a", "outsider")], {
      contestantIds: ["a", "b", "unseen", "also-unseen"],
      halfLifeDays: 30,
      now: NOW,
    });

    expect(ranking.ranked.map((r) => r.contestantId)).toEqual(["a", "b"]);
    expect(ranking.ranked[0]).toMatchObject({ wins: 1, matches: 1 });
    expect(ranking.notYetJudged).toEqual(["unseen", "also-unseen"]);
  });

  it("orders by score, so a lucky contestant with a higher rating stays below a proven one", () => {
    const matches = [match("lucky", "x"), match("lucky", "x")];
    for (let i = 0; i < 30; i++) matches.push(i < 18 ? match("proven", "y") : match("y", "proven"));

    const { ranked } = calculateRanking(matches, { contestantIds: ["lucky", "x", "proven", "y"], halfLifeDays: null, now: NOW });
    const lucky = ranked.find((r) => r.contestantId === "lucky")!;
    const proven = ranked.find((r) => r.contestantId === "proven")!;

    expect(lucky.rating).toBeGreaterThan(proven.rating);
    expect(ranked.indexOf(proven)).toBeLessThan(ranked.indexOf(lucky));
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
  });
});
