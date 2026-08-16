import {
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
} from "date-fns";

export type PlanningView = "day" | "week" | "month";

/** I1.1 — Vorige/Volgende step by the active unit. */
export function stepDate(view: PlanningView, date: Date, direction: 1 | -1): Date {
  if (view === "day") return direction === 1 ? addDays(date, 1) : subDays(date, 1);
  if (view === "week") return direction === 1 ? addWeeks(date, 1) : subWeeks(date, 1);
  return direction === 1 ? addMonths(date, 1) : subMonths(date, 1);
}

/** I1.2 — every day cell the month grid renders, including
 * leading/trailing padding from the surrounding weeks (weekStartsOn: 1,
 * matching the existing week view). */
export function monthGridDays(date: Date): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }),
  });
}

export function parseViewParam(value: string | null): PlanningView {
  return value === "day" || value === "month" ? value : "week";
}

export function parseDateParam(value: string | null): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
