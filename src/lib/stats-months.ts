import { differenceInCalendarDays } from "date-fns";

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Every "YYYY-MM" month key from `from` to `to` inclusive, one per
 * calendar month touched. */
export function monthsInRange(from: Date, to: Date): string[] {
  const months: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor <= end) {
    months.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

/**
 * K1.1's decided pro-rata rule for a period spanning a month boundary
 * (e.g. 2026-05-28 → 2026-06-03): split its cost by calendar days
 * actually falling in each month, never bucketed wholesale by
 * `startDate` (`periodDays`, pricing.ts, only returns a whole-period
 * count — it has no concept of splitting across months, and other
 * callers there depend on it staying a plain day count). Returns each
 * touched month's share of the period's total days — weights sum to 1.
 */
export function monthWeights(start: Date, end: Date): Map<string, number> {
  const totalDays = Math.max(1, differenceInCalendarDays(end, start) + 1);
  const counts = new Map<string, number>();
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  for (let i = 0; i < totalDays; i++) {
    const key = monthKey(cursor);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    cursor.setDate(cursor.getDate() + 1);
  }
  const weights = new Map<string, number>();
  for (const [key, count] of counts) weights.set(key, count / totalDays);
  return weights;
}
