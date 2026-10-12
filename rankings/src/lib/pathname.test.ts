import { describe, expect, it } from "vitest";
import { safeNextPath } from "./pathname";

describe("safeNextPath", () => {
  it("keeps paths on this site", () => {
    expect(safeNextPath("/tournaments/new?x=1")).toBe("/tournaments/new?x=1");
  });

  it("falls back to the home page for missing or off-site targets", () => {
    for (const next of [null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example"]) {
      expect(safeNextPath(next)).toBe("/");
    }
  });
});
