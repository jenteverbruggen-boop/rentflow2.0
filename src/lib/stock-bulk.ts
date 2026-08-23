/**
 * Pure selection logic for bulk stock-item (unit) add/remove. No Prisma
 * import here on purpose — dev/CI run entirely on SQLite, so keeping the
 * actual selection rules DB-free is what makes them unit-testable at all
 * (stock-bulk.test.ts) without a database.
 */

export interface BulkUnit {
  id: number;
  unitNumber: number;
  /** Count of PeriodStockItem rows ever booked against this unit —
   * including historical ones. Any count > 0 makes the unit permanently
   * undeletable (see stock-items/bulk/route.ts's DELETE handler). */
  bookingCount: number;
}

export interface RemovalSelection {
  ids: number[];
  unitNumbers: number[];
  blockedUnits: number[];
  removable: number;
  /**
   * How many units can actually be removed *right now* under the
   * highest-first, all-or-nothing rule: the length of the unbroken run
   * of unbooked units counting down from the highest unitNumber.
   *
   * This — not `removable` — is what a "remove the maximum" affordance
   * must target. `removable` counts free units across the whole
   * material, so a single booked unit sitting below the top caps the
   * real maximum far lower: units 1..50 with only #45 booked have
   * removable: 49 but removableFromTop: 5, and asking for 49 would be
   * rejected all over again.
   */
  removableFromTop: number;
}

export interface IdSelection {
  ids: number[];
  blockedUnits: number[];
  unknownIds: number[];
}

/**
 * Picks the `count` highest-unitNumber units as the removal target — a
 * fixed, contiguous-by-rank window, never a "skip past booked units and
 * keep going deeper" strategy. If any unit inside that window has ever
 * been booked, or there simply aren't `count` units to begin with, the
 * whole selection fails and reports the blockers instead of silently
 * substituting other units — the caller (the route) then deletes
 * nothing, matching the all-or-nothing contract.
 *
 * `removable` is the total count of currently-unbooked units across the
 * *whole* material (informational); `removableFromTop` is the largest
 * count that would actually succeed, and the one any "remove the
 * maximum" affordance must use.
 */
export function pickHighestRemovable(units: BulkUnit[], count: number): RemovalSelection {
  const removable = units.filter((u) => u.bookingCount === 0).length;
  const sorted = [...units].sort((a, b) => b.unitNumber - a.unitNumber);
  const firstBooked = sorted.findIndex((u) => u.bookingCount > 0);
  const removableFromTop = firstBooked === -1 ? sorted.length : firstBooked;
  const window = sorted.slice(0, count);
  const blocked = window.filter((u) => u.bookingCount > 0);
  const insufficient = count > units.length;

  if (blocked.length > 0 || insufficient) {
    const blockedUnits = [...new Set(blocked.map((u) => u.unitNumber))].sort((a, b) => a - b);
    return { ids: [], unitNumbers: [], blockedUnits, removable, removableFromTop };
  }

  return {
    ids: window.map((u) => u.id),
    unitNumbers: window.map((u) => u.unitNumber).sort((a, b) => a - b),
    blockedUnits: [],
    removable,
    removableFromTop,
  };
}

/**
 * Validates an explicit id-based removal selection: every id must exist
 * on this material (`unknownIds` otherwise) and be unbooked
 * (`blockedUnits` otherwise). `ids` is only populated when both lists
 * are empty — same all-or-nothing contract as pickHighestRemovable.
 */
export function validateIdSelection(units: BulkUnit[], ids: number[]): IdSelection {
  const byId = new Map(units.map((u) => [u.id, u]));
  const unknownIds: number[] = [];
  const blockedUnits: number[] = [];
  const valid: number[] = [];

  for (const id of ids) {
    const unit = byId.get(id);
    if (!unit) {
      unknownIds.push(id);
      continue;
    }
    if (unit.bookingCount > 0) {
      blockedUnits.push(unit.unitNumber);
      continue;
    }
    valid.push(id);
  }

  const ok = unknownIds.length === 0 && blockedUnits.length === 0;
  return {
    ids: ok ? valid : [],
    blockedUnits: blockedUnits.sort((a, b) => a - b),
    unknownIds,
  };
}

/** The next `count` unit numbers after `maxUnitNumber`, e.g. (5, 3) => [6, 7, 8]. */
export function nextUnitNumbers(maxUnitNumber: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => maxUnitNumber + i + 1);
}
