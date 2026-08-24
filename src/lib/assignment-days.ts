import { effectiveWindows, type TimeWindow } from "@/lib/assignment-window";

/**
 * H6 — how much an assignment actually bills once it can be booked for
 * *specific days* of a period instead of the whole run.
 *
 * The rule (PO decision): selected days are billed, nothing else. An
 * assignment with no day rows keeps billing the whole period exactly as
 * before, so no existing booking changes value.
 */

interface DayLike {
  startAt: Date | string | null;
  endAt: Date | string | null;
}

interface AssignmentLike extends DayLike {
  /** Only read when the assignment has no day rows — see effectiveWindows(). */
  period?: { startDate: Date | string; endDate: Date | string };
  days?: DayLike[] | null;
}

/**
 * How many days one window bills. Measured in elapsed time, not calendar
 * dates, on purpose: `differenceInCalendarDays` answers in whichever
 * timezone the code happens to run in, so a 22:00–06:00 night shift
 * billed 1 day on the client (Brussels) and 2 on the server (UTC) — a
 * money figure must not depend on that. One shift of 24h or less is one
 * day; anything longer rounds up.
 */
function windowDays(w: TimeWindow): number {
  const hours = (w.to.getTime() - w.from.getTime()) / 3_600_000;
  return Math.max(1, Math.ceil(hours / 24));
}

/**
 * The number of days to bill. `fallbackDays` is the period's own day
 * count — used verbatim when the assignment has no day rows, which is
 * every booking made before H6.
 *
 * A day row is one working day by construction (the picker creates one
 * per selected day, night shifts included); a row longer than 24h is
 * counted by `windowDays` rather than as a single day.
 */
export function billedDays(assignment: AssignmentLike, fallbackDays: number): number {
  const days = (assignment.days ?? []).filter((d) => d.startAt != null && d.endAt != null);
  if (days.length === 0) return fallbackDays;
  return effectiveWindows(assignment).reduce((acc, w) => acc + windowDays(w), 0);
}

/** Total booked hours across every window — the "uur" counterpart of
 * `billedDays`. Returns null when the assignment has no explicit window
 * at all (a whole-period booking has no meaningful hour count; Q19's
 * day fallback applies instead). */
export function billedHours(assignment: AssignmentLike): number | null {
  const hasDays = (assignment.days ?? []).some((d) => d.startAt != null && d.endAt != null);
  if (!hasDays && (assignment.startAt == null || assignment.endAt == null)) return null;
  const total = effectiveWindows(assignment).reduce(
    (acc, w) => acc + (w.to.getTime() - w.from.getTime()) / 3_600_000,
    0,
  );
  return Math.round(total * 100) / 100;
}

/**
 * Validates a replacement set of day windows for one assignment: each
 * window inside its own period, ending after it starts, and no two
 * windows overlapping each other (two overlapping windows on one
 * assignment would double-bill the same hours). Returns an error
 * message, or null when the whole set is valid.
 */
export function validateAssignmentDays(
  days: { startAt: Date; endAt: Date }[],
  period: { startDate: Date; endDate: Date },
): string | null {
  for (const d of days) {
    if (Number.isNaN(d.startAt.getTime()) || Number.isNaN(d.endAt.getTime())) {
      return "Ongeldige datum";
    }
    if (d.endAt <= d.startAt) return "Einde moet na start liggen";
    if (d.startAt < period.startDate || d.endAt > period.endDate) {
      return "Dagen moeten binnen de periode vallen";
    }
  }
  const sorted = [...days].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startAt < sorted[i - 1].endAt) {
      return "Dagen mogen niet overlappen";
    }
  }
  return null;
}

/** The envelope persisted onto `PeriodPerson.startAt`/`endAt` whenever
 * day rows are written, so single-window consumers (planning board, ICS
 * feed) keep showing the right span. Null for an empty set — that means
 * "back to the whole period". */
export function daysEnvelope(
  days: { startAt: Date; endAt: Date }[],
): { startAt: Date; endAt: Date } | null {
  if (days.length === 0) return null;
  return {
    startAt: days.reduce((min, d) => (d.startAt < min ? d.startAt : min), days[0].startAt),
    endAt: days.reduce((max, d) => (d.endAt > max ? d.endAt : max), days[0].endAt),
  };
}
