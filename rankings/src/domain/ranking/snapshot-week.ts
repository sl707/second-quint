import { allowanceDay } from "@/domain/allowance/allowance";

const DAY = 24 * 60 * 60 * 1000;

/**
 * The week of global rated rating snapshots that `instant` falls in, as the `YYYY-MM-DD` of its
 * Monday. Weeks run Monday to Sunday in New York, like allowance days.
 */
export function snapshotWeek(instant: Date): string {
  const day = new Date(`${allowanceDay(instant)}T00:00:00Z`);
  const daysSinceMonday = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - daysSinceMonday * DAY).toISOString().slice(0, 10);
}
