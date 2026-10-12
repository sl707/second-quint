import { describe, expect, it } from "vitest";
import { roundName, stageOfMatch } from "./stage";

describe("roundName", () => {
  it("names a bracket round by how far it is from the final", () => {
    expect([1, 2, 3, 4, 5].map((round) => roundName(round, 5))).toEqual([
      "Round of 32",
      "Round of 16",
      "Quarterfinals",
      "Semifinals",
      "Final",
    ]);
    expect(roundName(1, 2)).toBe("Semifinals");
  });
});

const names = (size: number) => Array.from({ length: size }, (_, i) => stageOfMatch(size, i).name);

describe("stageOfMatch", () => {
  it("names each match of a 4-contestant tournament in play order", () => {
    expect(names(4)).toEqual(["Semifinals", "Semifinals", "Third-place match", "Final"]);
  });

  it("counts only the real first-round matches when there are byes", () => {
    expect(names(5)).toEqual(["Quarterfinals", "Semifinals", "Semifinals", "Third-place match", "Final"]);
  });

  it("names rounds before the quarterfinals by how many slots they have", () => {
    expect(names(16)).toEqual([
      ...Array(8).fill("Round of 16"),
      ...Array(4).fill("Quarterfinals"),
      "Semifinals",
      "Semifinals",
      "Third-place match",
      "Final",
    ]);
    expect(stageOfMatch(20, 0).name).toBe("Round of 32");
    expect(stageOfMatch(20, 4).name).toBe("Round of 16");
  });

  it("orders stages from the first round to the final", () => {
    const order = ["Round of 16", "Quarterfinals", "Semifinals", "Third-place match", "Final"].map(
      (name) => stageOfMatch(16, names(16).indexOf(name)).fromFinal,
    );
    expect(order).toEqual([...order].sort((a, b) => b - a));
    expect(new Set(order).size).toBe(order.length);
  });

  it("refuses a match the tournament doesn't have", () => {
    expect(() => stageOfMatch(4, 4)).toThrow();
    expect(() => stageOfMatch(4, -1)).toThrow();
  });
});
