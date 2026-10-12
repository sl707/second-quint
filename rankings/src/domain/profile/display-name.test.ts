import { describe, expect, it } from "vitest";
import { checkDisplayName } from "./display-name";

const SYMBOLS = "Use only letters, digits, spaces, underscores, and hyphens.";
const LENGTH = "Display names are 3 to 24 characters.";

describe("checkDisplayName", () => {
  it("accepts 3 to 24 letters, digits, underscores, and hyphens, trimming spaces around it", () => {
    expect(checkDisplayName("  Pizza_Fan-99 ")).toEqual({ ok: true, displayName: "Pizza_Fan-99" });
    expect(checkDisplayName("abc")).toMatchObject({ ok: true });
    expect(checkDisplayName("a".repeat(24))).toMatchObject({ ok: true });
  });

  it("accepts letters and digits from any script", () => {
    for (const name of ["Zoë", "Ελένη", "日本語", "Владимир", "محمد٣"]) {
      expect(checkDisplayName(name)).toEqual({ ok: true, displayName: name });
    }
  });

  it("accepts spaces between words, collapsing runs of them into one", () => {
    expect(checkDisplayName(" Pizza   Fan\t99 ")).toEqual({ ok: true, displayName: "Pizza Fan 99" });
  });

  it("composes accents, so the same-looking name is the same name", () => {
    expect(checkDisplayName("Zoe\u0308")).toEqual({ ok: true, displayName: "Zo\u00eb" });
  });

  it("refuses names shorter than 3 or longer than 24 characters once normalized", () => {
    expect(checkDisplayName("ab")).toEqual({ ok: false, reason: LENGTH });
    expect(checkDisplayName("a      b")).toEqual({ ok: true, displayName: "a b" });
    expect(checkDisplayName(" ab  ")).toEqual({ ok: false, reason: LENGTH });
    expect(checkDisplayName("a".repeat(25))).toEqual({ ok: false, reason: LENGTH });
    expect(checkDisplayName("日".repeat(24))).toMatchObject({ ok: true });
    expect(checkDisplayName("日".repeat(25))).toEqual({ ok: false, reason: LENGTH });
  });

  it("refuses symbols and punctuation", () => {
    for (const name of ["pizza@fan", "../admin", "a/b/c", "pizza.fan", "fan%20", "pizza😀fan"]) {
      expect(checkDisplayName(name)).toEqual({ ok: false, reason: SYMBOLS });
    }
  });
});
