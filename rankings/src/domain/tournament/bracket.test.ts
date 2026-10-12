import { describe, expect, it } from "vitest";
import { drawBracket, playBracket, type Pick, type Slot } from "./bracket";

const pool = (n: number) => Array.from({ length: n }, (_, i) => `c${i + 1}`);

function pairs<T>(slots: T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < slots.length; i += 2) out.push([slots[i], slots[i + 1]]);
  return out;
}

describe("drawBracket", () => {
  it("fills a bracket of the next power of two with byes, each paired with a real contestant", () => {
    for (const size of [4, 5, 6, 7, 8, 9, 12, 16, 17, 31]) {
      const slots = drawBracket(pool(40), size);
      const bracketSize = size <= 4 ? 4 : size <= 8 ? 8 : size <= 16 ? 16 : 32;
      expect(slots).toHaveLength(bracketSize);
      expect(slots.filter((s) => s === null)).toHaveLength(bracketSize - size);
      for (const [a, b] of pairs(slots)) expect(a !== null || b !== null).toBe(true);
    }
  });

  it("draws distinct contestants from the scope", () => {
    const scope = pool(20);
    const drawn = drawBracket(scope, 10).filter((s): s is string => s !== null);
    expect(new Set(drawn).size).toBe(10);
    for (const id of drawn) expect(scope).toContain(id);
  });

  it("draws and places contestants at random", () => {
    const first = new Set(Array.from({ length: 30 }, () => drawBracket(pool(16), 8).join(",")));
    expect(first.size).toBeGreaterThan(1);
  });

  it("refuses sizes outside 4 to the scope's contestant count", () => {
    expect(() => drawBracket(pool(10), 3)).toThrow();
    expect(() => drawBracket(pool(10), 11)).toThrow();
  });
});

/** Plays every match, letting `choose` pick the winner from the two contestants. */
function playOut(slots: Slot[], choose: (a: string, b: string) => string = (a) => a): Pick[] {
  const picks: Pick[] = [];
  for (let state = playBracket(slots, picks); state.next; state = playBracket(slots, picks)) {
    const [a, b] = state.next.contestantIds;
    const winnerId = choose(a, b);
    picks.push({ winnerId, loserId: winnerId === a ? b : a });
  }
  return picks;
}

describe("playBracket", () => {
  it("plays exactly N matches for N contestants, counting the third-place match", () => {
    for (const size of [4, 5, 6, 7, 8, 11, 16, 23]) {
      const slots = drawBracket(pool(size), size);
      expect(playBracket(slots, []).matchesLeft).toBe(size);
      const picks = playOut(slots);
      expect(picks).toHaveLength(size);
      const done = playBracket(slots, picks);
      expect(done.finished).toBe(true);
      expect(done.matchesLeft).toBe(0);
    }
  });

  it("puts the semifinal losers in a third-place match, played before the final", () => {
    const slots = ["a", "b", "c", "d"];
    const state = playBracket(slots, [
      { winnerId: "a", loserId: "b" },
      { winnerId: "d", loserId: "c" },
    ]);
    expect(state.next).toEqual({ index: 2, round: 2, thirdPlace: true, contestantIds: ["b", "c"] });
  });

  it("advances byes without a match", () => {
    const state = playBracket(["a", null, "b", "c", null, "d", "e", "f"], []);
    expect(state.next?.contestantIds).toEqual(["b", "c"]);
    expect(state.rounds[1][0].contestantIds).toEqual(["a", null]);
    expect(state.rounds[1][1].contestantIds).toEqual(["d", null]);
  });

  it("refuses a pick that isn't the next match", () => {
    expect(() => playBracket(["a", "b", "c", "d"], [{ winnerId: "c", loserId: "d" }])).toThrow();
  });

  it("ranks a finished tournament 1st to 4th, then in tied tiers by round of elimination", () => {
    const slots = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p"];
    const picks = playOut(slots, (x, y) => (x < y ? x : y));
    expect(playBracket(slots, picks).ranking).toEqual([
      { place: "1st", contestantIds: ["a"] },
      { place: "2nd", contestantIds: ["i"] },
      { place: "3rd", contestantIds: ["e"] },
      { place: "4th", contestantIds: ["m"] },
      { place: "5th–8th", contestantIds: ["c", "g", "k", "o"] },
      { place: "9th–16th", contestantIds: ["b", "d", "f", "h", "j", "l", "n", "p"] },
    ]);
  });

  it("sizes the last tier to the contestants actually in it when there are byes", () => {
    const slots = ["a", null, "b", "c", null, "d", "e", "f"];
    const picks = playOut(slots, (x, y) => (x < y ? x : y));
    expect(playBracket(slots, picks).ranking).toEqual([
      { place: "1st", contestantIds: ["a"] },
      { place: "2nd", contestantIds: ["d"] },
      { place: "3rd", contestantIds: ["b"] },
      { place: "4th", contestantIds: ["e"] },
      { place: "5th–6th", contestantIds: ["c", "f"] },
    ]);
  });

  it("has no tournament ranking until finished", () => {
    expect(playBracket(["a", "b", "c", "d"], [{ winnerId: "a", loserId: "b" }]).ranking).toBeNull();
  });
});
