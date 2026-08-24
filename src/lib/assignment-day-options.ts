import { addDays, eachDayOfInterval, format, startOfDay } from "date-fns";
import { nl } from "date-fns/locale";
import type { AssignmentDay } from "@/types";

/**
 * H6 — the rows the day picker renders for one period: one per calendar
 * day, pre-filled with the assignment's own days when it has them.
 *
 * All of this works in the *browser's* local timezone on purpose — the
 * picker's `type="time"` inputs are local wall-clock, and the popover
 * converts back to a full ISO instant before sending (same round-trip
 * period-form.tsx already does for period dates). Never truncate an ISO
 * string to `yyyy-MM-dd` to compare days: that reads as UTC midnight and
 * shifts the day for anyone east of Greenwich.
 */
export interface DayOption {
  /** Local calendar date, `yyyy-MM-dd` — the row's identity. */
  key: string;
  /** "ma 31 aug" — Dutch, matching the rest of the planning UI. */
  label: string;
  selected: boolean;
  /** Local wall-clock `HH:mm`. */
  from: string;
  to: string;
}

const DAY_KEY = "yyyy-MM-dd";
const TIME = "HH:mm";

function timeOfDay(date: Date): string {
  return format(date, TIME);
}

/**
 * The default working window for a day of this period: the period's own
 * start and end time-of-day (a "Week 1" period of 06:00–15:00 gives
 * every day 06:00–15:00). A period whose end time is not after its start
 * time — an overnight run — falls back to "until midnight".
 */
export function defaultDayTimes(periodStart: Date, periodEnd: Date): { from: string; to: string } {
  const from = timeOfDay(periodStart);
  const to = timeOfDay(periodEnd);
  return { from, to: to > from ? to : "23:59" };
}

/** Turn one picker row back into a real instant pair. A `to` that is not
 * after `from` means a night shift ending the next morning. */
export function dayOptionToWindow(option: DayOption): { startAt: string; endAt: string } {
  const startAt = new Date(`${option.key}T${option.from}`);
  let endAt = new Date(`${option.key}T${option.to}`);
  if (endAt <= startAt) endAt = addDays(endAt, 1);
  return { startAt: startAt.toISOString(), endAt: endAt.toISOString() };
}

/**
 * One row per calendar day of the period. Existing day rows win over the
 * defaults, so re-opening the picker shows exactly what was saved.
 */
export function buildDayOptions(
  period: { startDate: string; endDate: string },
  days: AssignmentDay[] | undefined,
): DayOption[] {
  const start = new Date(period.startDate);
  const end = new Date(period.endDate);
  const defaults = defaultDayTimes(start, end);
  const saved = new Map(
    (days ?? []).map((d) => {
      const from = new Date(d.startAt);
      return [format(from, DAY_KEY), { from: timeOfDay(from), to: timeOfDay(new Date(d.endAt)) }];
    }),
  );
  return eachDayOfInterval({ start: startOfDay(start), end: startOfDay(end) }).map((day) => {
    const key = format(day, DAY_KEY);
    const hit = saved.get(key);
    return {
      key,
      label: format(day, "eee d MMM", { locale: nl }),
      selected: hit != null,
      from: hit?.from ?? defaults.from,
      to: hit?.to ?? defaults.to,
    };
  });
}

/** The picker's payload: only the selected rows, as ISO instants. */
export function selectedWindows(options: DayOption[]): { startAt: string; endAt: string }[] {
  return options.filter((o) => o.selected).map(dayOptionToWindow);
}
