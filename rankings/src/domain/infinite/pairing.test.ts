import { describe, expect, it } from "vitest";
import { pickInfinitePair, type PairingCandidate } from "./pairing";

/** Plays back the given numbers in order, as the random source. */
function sequence(...values: number[]) {
  let i = 0;
  return () => values[i++];
}

/** A small seeded generator (mulberry32), so statistical checks are repeatable. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const candidate = (id: string, rating: number, matches = 0): PairingCandidate => ({ id, rating, matches });

describe("pickInfinitePair", () => {
  it("pairs the only two contestants in a scope of two", () => {
    expect(pickInfinitePair([candidate("a", 1500), candidate("b", 1900)], sequence(0, 0.99))).toEqual(["a", "b"]);
    expect(pickInfinitePair([candidate("a", 1500), candidate("b", 1900)], sequence(0.99, 0))).toEqual(["b", "a"]);
  });

  it("weights the first contestant by 1 + 3 / (1 + matches)", () => {
    // Weights 4 (no matches) and 1.75 (3 matches): a covers the first 4 / 5.75 ≈ 0.696 of the draw.
    const scope = [candidate("a", 1500, 0), candidate("b", 1500, 3)];
    expect(pickInfinitePair(scope, sequence(0.69, 0))[0]).toBe("a");
    expect(pickInfinitePair(scope, sequence(0.7, 0))[0]).toBe("b");
  });

  it("weights the second contestant toward a close rating, with a floor for far ones", () => {
    // After a: b (10 points away) weighs 4 × (e^−0.1 + 0.1) ≈ 4.019, c (600 away) 4 × (e^−6 + 0.1) ≈ 0.410.
    const scope = [candidate("a", 1500), candidate("b", 1510), candidate("c", 2100)];
    expect(pickInfinitePair(scope, sequence(0, 0.9))).toEqual(["a", "b"]);
    expect(pickInfinitePair(scope, sequence(0, 0.92))).toEqual(["a", "c"]);
  });

  it("mixes close, informative pairs with varied ones", () => {
    const scope = Array.from({ length: 64 }, (_, i) => candidate(`c${i}`, 1100 + (800 * i) / 63, 10));
    const rating = new Map(scope.map((c) => [c.id, c.rating]));
    const random = seeded(8);
    const gaps = Array.from({ length: 4000 }, () => {
      const [a, b] = pickInfinitePair(scope, random);
      expect(a).not.toBe(b);
      return Math.abs(rating.get(a)! - rating.get(b)!);
    });
    const share = (test: (gap: number) => boolean) => gaps.filter(test).length / gaps.length;

    expect(share((g) => g <= 100)).toBeGreaterThan(0.35);
    expect(share((g) => g <= 100)).toBeLessThan(0.75);
    expect(share((g) => g > 300)).toBeGreaterThan(0.08);
  });

  it("favors contestants with few matches", () => {
    const scope = [candidate("new", 1500, 0), ...Array.from({ length: 9 }, (_, i) => candidate(`old${i}`, 1500, 50))];
    const random = seeded(3);
    const draws = 3000;
    let withNew = 0;
    for (let i = 0; i < draws; i++) if (pickInfinitePair(scope, random).includes("new")) withNew++;
    // Weights 4 vs 1.06: the newcomer is in about half the pairs, against 20% if all were equal.
    expect(withNew / draws).toBeGreaterThan(0.45);
  });

  it("refuses a scope with fewer than two contestants", () => {
    expect(() => pickInfinitePair([candidate("a", 1500)], Math.random)).toThrow();
  });
});
