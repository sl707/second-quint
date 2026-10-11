import { describe, expect, it } from "vitest";
import { matchCountFor } from "./match-count";

describe("matchCountFor", () => {
  it("counts bracket matches plus the third-place match", () => {
    expect(matchCountFor(4)).toBe(4);
    expect(matchCountFor(6)).toBe(6);
    expect(matchCountFor(16)).toBe(16);
  });

  it("refuses tournaments smaller than 4", () => {
    expect(() => matchCountFor(3)).toThrow();
  });
});
