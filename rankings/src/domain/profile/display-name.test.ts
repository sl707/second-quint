import { describe, expect, it } from "vitest";
import { checkDisplayName } from "./display-name";

describe("checkDisplayName", () => {
  it("accepts 3 to 24 letters, digits, underscores, and hyphens, trimming spaces around it", () => {
    expect(checkDisplayName("  Pizza_Fan-99 ")).toEqual({ ok: true, displayName: "Pizza_Fan-99" });
    expect(checkDisplayName("abc")).toMatchObject({ ok: true });
    expect(checkDisplayName("a".repeat(24))).toMatchObject({ ok: true });
  });

  it("refuses names shorter than 3 or longer than 24 characters", () => {
    expect(checkDisplayName("ab")).toEqual({ ok: false, reason: "Display names are 3 to 24 characters." });
    expect(checkDisplayName("a".repeat(25))).toEqual({ ok: false, reason: "Display names are 3 to 24 characters." });
  });

  it("refuses spaces and symbols, so a name works in a profile address", () => {
    for (const name of ["pizza fan", "pizza@fan", "pizzä", "../admin"]) {
      expect(checkDisplayName(name)).toEqual({
        ok: false,
        reason: "Use only letters, digits, underscores, and hyphens.",
      });
    }
  });
});
