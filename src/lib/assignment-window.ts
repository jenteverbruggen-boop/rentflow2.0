/**
 * H1 — assignment-level time windows. Extracted out of availability.ts
 * (which was already at 136 lines before this item, no headroom left
 * for these two functions) rather than inlined there.
 *
 * H6 adds *multiple* windows per assignment (`days`): a person booked
 * for specific days of a period instead of the whole run. The three
 * shapes an assignment can have, in precedence order:
 *
 *   1. `days` rows        → exactly those windows (H6)
 *   2. `startAt`/`endAt`  → one window inside the period (H1.3)
 *   3. neither            → the whole period (the default)
 *
 * Every function here treats 1 as a generalisation of 2, so a row from
 * before H6 keeps behaving byte-identically.
 */

interface WindowLike {
  startAt: Date | string | null;
  endAt: Date | string | null;
}

interface AssignmentLike extends WindowLike {
  /** Optional so a wire-shaped assignment (which carries `days` but not
   * its parent period) can be passed too. Without it, and without an
   * explicit window or day rows, there is nothing to fall back to and
   * the window list is empty. */
  period?: { startDate: Date | string; endDate: Date | string };
  days?: WindowLike[] | null;
}

export interface TimeWindow {
  from: Date;
  to: Date;
}

function asDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

/**
 * Every window the assignment is actually booked for. One entry for the
 * pre-H6 shapes, one per selected day once `days` is populated. Kept as
 * a pure function so a null window (every row before H1.3, and any row
 * H1.3/H6 leaves unset) reproduces the exact pre-H1 period-level check,
 * not an approximation of it.
 */
export function effectiveWindows(assignment: AssignmentLike): TimeWindow[] {
  const days = assignment.days ?? [];
  const dayWindows = days
    .filter((d) => d.startAt != null && d.endAt != null)
    .map((d) => ({ from: asDate(d.startAt!), to: asDate(d.endAt!) }))
    .sort((a, b) => a.from.getTime() - b.from.getTime());
  if (dayWindows.length > 0) return dayWindows;
  const from = assignment.startAt ?? assignment.period?.startDate;
  const to = assignment.endAt ?? assignment.period?.endDate;
  if (from == null || to == null) return [];
  return [{ from: asDate(from), to: asDate(to) }];
}

/**
 * The single window an assignment spans — the envelope (earliest start,
 * latest end) once it has day rows. Consumers that can only render one
 * bar or one calendar event (the planning board, the ICS feed) keep
 * using this; overlap checks use `effectiveWindows()` so a gap day is
 * not treated as booked.
 */
export function effectiveWindow(
  assignment: AssignmentLike & { period: { startDate: Date | string; endDate: Date | string } },
): TimeWindow {
  const windows = effectiveWindows(assignment);
  return {
    from: windows[0].from,
    to: windows.reduce((latest, w) => (w.to > latest ? w.to : latest), windows[0].to),
  };
}

/** True when any of the assignment's windows overlaps `[from, to)`. */
export function overlapsWindow(
  assignment: AssignmentLike,
  range: { from: Date; to: Date },
): TimeWindow | null {
  return (
    effectiveWindows(assignment).find((w) => w.from < range.to && w.to > range.from) ?? null
  );
}

/**
 * Server-side validation for a custom assignment window (H1.3): it
 * must fall inside its own period, and end strictly after it starts.
 * Returns an error message, or null when the window is valid.
 */
export function validateAssignmentWindow(
  window: { startAt: Date; endAt: Date },
  period: { startDate: Date; endDate: Date },
): string | null {
  if (window.endAt <= window.startAt) {
    return "Einde moet na start liggen";
  }
  if (window.startAt < period.startDate || window.endAt > period.endDate) {
    return "Uren moeten binnen de periode vallen";
  }
  return null;
}
