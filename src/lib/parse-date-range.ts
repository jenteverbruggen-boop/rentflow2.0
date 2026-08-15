/**
 * Parse and validate a `from`/`to` availability query range. Lives outside
 * availability.ts deliberately — that file stays a pure function library
 * (H3), validation belongs at the route boundary before the bad input ever
 * reaches a Prisma lt/gt comparison (an unparseable or inverted range
 * doesn't throw there, it just silently matches nothing).
 */
export function parseDateRange(
  from: string | null,
  to: string | null,
): { from: Date; to: Date } | null {
  if (!from || !to) return null;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return null;
  }
  if (toDate.getTime() <= fromDate.getTime()) return null;
  return { from: fromDate, to: toDate };
}
