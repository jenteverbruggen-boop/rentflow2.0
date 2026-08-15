/**
 * H1 — assignment-level time windows. Extracted out of availability.ts
 * (which was already at 136 lines before this item, no headroom left
 * for these two functions) rather than inlined there.
 */

/**
 * The window an assignment is actually booked for — its own
 * `startAt`/`endAt` when set, else the whole period's. Kept as a pure
 * function so a null window (every row before H1.3, and any row H1.3
 * leaves unset) reproduces the exact pre-H1 period-level check, not an
 * approximation of it.
 */
export function effectiveWindow(assignment: {
  startAt: Date | null;
  endAt: Date | null;
  period: { startDate: Date; endDate: Date };
}): { from: Date; to: Date } {
  return {
    from: assignment.startAt ?? assignment.period.startDate,
    to: assignment.endAt ?? assignment.period.endDate,
  };
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
