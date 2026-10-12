import { describe, expect, it } from "vitest";
import { allowanceDay, nextAllowanceReset, ratedAllowance } from "./allowance";

describe("ratedAllowance", () => {
  it("equals the number of contestants in a category", () => {
    expect(ratedAllowance({ allContestants: false, contestantCount: 37 })).toBe(37);
  });

  it("is at least 20, even for a small scope", () => {
    expect(ratedAllowance({ allContestants: false, contestantCount: 5 })).toBe(20);
    expect(ratedAllowance({ allContestants: true, contestantCount: 0 })).toBe(20);
  });

  it("is at most 500 for the all-contestants scope", () => {
    expect(ratedAllowance({ allContestants: true, contestantCount: 499 })).toBe(499);
    expect(ratedAllowance({ allContestants: true, contestantCount: 4200 })).toBe(500);
  });

  it("has no cap for a category", () => {
    expect(ratedAllowance({ allContestants: false, contestantCount: 900 })).toBe(900);
  });
});

describe("allowance days", () => {
  it("run midnight to midnight in New York, not UTC", () => {
    // 11:59 PM EDT on Oct 11 is already Oct 12 in UTC.
    expect(allowanceDay(new Date("2026-10-12T03:59:00Z"))).toBe("2026-10-11");
    expect(allowanceDay(new Date("2026-10-12T04:00:00Z"))).toBe("2026-10-12");
    expect(nextAllowanceReset(new Date("2026-10-12T03:59:00Z"))).toEqual(new Date("2026-10-12T04:00:00Z"));
  });

  it("reset at midnight Eastern standard time in winter", () => {
    expect(allowanceDay(new Date("2026-01-15T04:59:59Z"))).toBe("2026-01-14");
    expect(allowanceDay(new Date("2026-01-15T05:00:00Z"))).toBe("2026-01-15");
    expect(nextAllowanceReset(new Date("2026-01-15T05:00:00Z"))).toEqual(new Date("2026-01-16T05:00:00Z"));
  });

  it("are 23 hours long when clocks spring forward", () => {
    expect(allowanceDay(new Date("2026-03-08T05:00:00Z"))).toBe("2026-03-08");
    expect(nextAllowanceReset(new Date("2026-03-08T05:00:00Z"))).toEqual(new Date("2026-03-09T04:00:00Z"));
    expect(nextAllowanceReset(new Date("2026-03-08T04:59:59Z"))).toEqual(new Date("2026-03-08T05:00:00Z"));
  });

  it("are 25 hours long when clocks fall back", () => {
    expect(allowanceDay(new Date("2026-11-01T04:00:00Z"))).toBe("2026-11-01");
    expect(allowanceDay(new Date("2026-11-02T04:59:59Z"))).toBe("2026-11-01");
    expect(nextAllowanceReset(new Date("2026-11-01T04:00:00Z"))).toEqual(new Date("2026-11-02T05:00:00Z"));
  });
});
