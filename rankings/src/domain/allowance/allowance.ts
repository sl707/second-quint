export const MIN_ALLOWANCE = 20;
export const MAX_ALL_CONTESTANTS_ALLOWANCE = 500;
export const ALLOWANCE_TIME_ZONE = "America/New_York";
/** Skips one account can use per allowance day across all Infinite Mode while playing rated. */
export const RATED_SKIPS_PER_DAY = 5;

/** How many rated matches one account can record in a scope per day. */
export function ratedAllowance({ allContestants, contestantCount }: { allContestants: boolean; contestantCount: number }): number {
  const allowance = Math.max(MIN_ALLOWANCE, contestantCount);
  return allContestants ? Math.min(MAX_ALL_CONTESTANTS_ALLOWANCE, allowance) : allowance;
}

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: ALLOWANCE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const wallClockFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: ALLOWANCE_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** The allowance day `instant` falls in, as `YYYY-MM-DD` in New York. */
export function allowanceDay(instant: Date): string {
  return dayFormat.format(instant);
}

/** How far New York's wall clock is ahead of UTC at `instant`, in milliseconds (negative). */
function newYorkOffset(instant: number): number {
  const parts = Object.fromEntries(wallClockFormat.formatToParts(instant).map((p) => [p.type, Number(p.value)]));
  const wallClock = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wallClock - Math.floor(instant / 1000) * 1000;
}

/** The next midnight in New York after `instant`, when the allowance resets. */
export function nextAllowanceReset(instant: Date): Date {
  const [year, month, day] = allowanceDay(instant).split("-").map(Number);
  const midnightAsUtc = Date.UTC(year, month - 1, day + 1);
  // New York's clock changes at 2 AM, never at midnight, so a second pass always settles the offset.
  const guess = midnightAsUtc - newYorkOffset(midnightAsUtc);
  return new Date(midnightAsUtc - newYorkOffset(guess));
}
