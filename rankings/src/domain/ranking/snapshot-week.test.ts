import { describe, expect, it } from "vitest";
import { snapshotWeek } from "./snapshot-week";

describe("rating snapshot weeks", () => {
  it("run Monday to Sunday in New York, named by their Monday", () => {
    // Sunday Oct 11, 2026, 11:59 PM EDT is already Monday in UTC.
    expect(snapshotWeek(new Date("2026-10-12T03:59:00Z"))).toBe("2026-10-05");
    expect(snapshotWeek(new Date("2026-10-12T04:00:00Z"))).toBe("2026-10-12");
    expect(snapshotWeek(new Date("2026-10-15T12:00:00Z"))).toBe("2026-10-12");
  });

  it("cross month and year boundaries", () => {
    // Friday Jan 1, 2027 belongs to the week starting Monday Dec 28, 2026.
    expect(snapshotWeek(new Date("2027-01-01T17:00:00Z"))).toBe("2026-12-28");
  });
});
