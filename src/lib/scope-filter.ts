import type { Prisma } from "@/generated/prisma/client";

export interface ScopeAccess {
  scope: "all" | "own";
  personId: number | null;
}

/**
 * Project-level ownership filter for `scope: own` callers (N5.2,
 * own-data-scoping-design.md §1.4). An explicit helper composed by hand
 * into the small, enumerated list of routes that need it — not a global
 * Prisma client extension, which would risk silently filtering
 * src/lib/availability.ts and src/lib/booking.ts's deliberately
 * company-wide conflict/availability queries (design doc §1.3).
 *
 * - `scope: "all"` → `undefined` (spread as `...(scopeFilter(access) ?? {})`,
 *   a no-op).
 * - `scope: "own"` → matches a project the caller is booked on via
 *   *any* period (decided requirement 2: the caller sees every period
 *   of an owned project, not only the one they're personally on) — the
 *   filter is applied only at the Project level, never additionally to
 *   the nested periods/people/materials includes.
 * - `scope: "own"` with `personId: null` (no linked person yet) → a
 *   clause that can never match, never a silent "no filter" fallback.
 *   Callers may additionally short-circuit before querying at all for
 *   this case (see §6 of the design doc) — this function's contract
 *   is just to never leak company-wide data if that short-circuit is
 *   skipped.
 */
export function scopeFilter(
  access: ScopeAccess,
): Prisma.ProjectWhereInput | undefined {
  if (access.scope !== "own") return undefined;
  const personId = access.personId ?? -1;
  return { periods: { some: { people: { some: { personId } } } } };
}
