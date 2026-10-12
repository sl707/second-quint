import { describe, expect, it } from "vitest";
import { tournamentSizeOptions } from "./size";

describe("tournamentSizeOptions", () => {
  it("allows 4 up to the scope's contestant count, defaulting to 16", () => {
    expect(tournamentSizeOptions(40)).toEqual({ min: 4, max: 40, default: 16 });
  });

  it("defaults to the scope size when it has fewer than 16 contestants", () => {
    expect(tournamentSizeOptions(9)).toEqual({ min: 4, max: 9, default: 9 });
  });

  it("offers no tournament for a scope of fewer than 4 contestants", () => {
    expect(tournamentSizeOptions(3)).toBeNull();
  });
});
