import { describe, expect, it } from "vitest";
import { nextUnitNumbers, pickHighestRemovable, validateIdSelection } from "./stock-bulk";
import type { BulkUnit } from "./stock-bulk";

function unit(id: number, unitNumber: number, bookingCount = 0): BulkUnit {
  return { id, unitNumber, bookingCount };
}

describe("pickHighestRemovable", () => {
  it("picks the highest unit numbers first when all are free", () => {
    const units = [unit(1, 1), unit(2, 2), unit(3, 3), unit(4, 4), unit(5, 5)];
    const result = pickHighestRemovable(units, 2);
    expect(result.unitNumbers).toEqual([4, 5]);
    expect(result.ids.sort()).toEqual([4, 5]);
    expect(result.blockedUnits).toEqual([]);
    expect(result.removable).toBe(5);
    expect(result.removableFromTop).toBe(5);
  });

  it("blocks the whole operation when a booked unit falls inside the target window", () => {
    // Units 1..5, #4 is booked. Removing the top 2 (4,5) must fail
    // entirely — it never silently substitutes unit #3 for #4.
    const units = [unit(1, 1), unit(2, 2), unit(3, 3), unit(4, 4, 1), unit(5, 5)];
    const result = pickHighestRemovable(units, 2);
    expect(result.ids).toEqual([]);
    expect(result.unitNumbers).toEqual([]);
    expect(result.blockedUnits).toEqual([4]);
    expect(result.removable).toBe(4);
  });

  it("reports every blocked unit inside a wider window, not just the first", () => {
    const units = [unit(1, 1, 1), unit(2, 2), unit(3, 3, 1), unit(4, 4), unit(5, 5)];
    const result = pickHighestRemovable(units, 5);
    expect(result.ids).toEqual([]);
    expect(result.blockedUnits).toEqual([1, 3]);
    expect(result.removable).toBe(3);
  });

  it("fails when count exceeds the total number of units", () => {
    const units = [unit(1, 1), unit(2, 2)];
    const result = pickHighestRemovable(units, 5);
    expect(result.ids).toEqual([]);
    expect(result.blockedUnits).toEqual([]);
    expect(result.removable).toBe(2);
  });

  it("fails when count exceeds the number of free units even though total is enough", () => {
    // 5 total, 1 booked (#3) => 4 free. Requesting all 5 hits the booked one.
    const units = [unit(1, 1), unit(2, 2), unit(3, 3, 2), unit(4, 4), unit(5, 5)];
    const result = pickHighestRemovable(units, 5);
    expect(result.ids).toEqual([]);
    expect(result.blockedUnits).toEqual([3]);
    expect(result.removable).toBe(4);
  });

  it("handles an empty stock list", () => {
    const result = pickHighestRemovable([], 1);
    expect(result.ids).toEqual([]);
    expect(result.blockedUnits).toEqual([]);
    expect(result.removable).toBe(0);
  });

  it("removing zero from an empty list is a no-op success", () => {
    const result = pickHighestRemovable([], 0);
    expect(result.ids).toEqual([]);
    expect(result.unitNumbers).toEqual([]);
    expect(result.blockedUnits).toEqual([]);
    expect(result.removable).toBe(0);
  });
});

describe("pickHighestRemovable — removableFromTop", () => {
  // The regression this exists for: `removable` counts free units across
  // the whole material, so offering it as "the maximum you can remove"
  // hands back a number that fails again the moment a booked unit sits
  // below the top of the numbering.
  it("stops at the first booked unit counting down, not at the free total", () => {
    const units = [
      ...Array.from({ length: 44 }, (_, i) => unit(i + 1, i + 1)),
      unit(45, 45, 1),
      ...Array.from({ length: 5 }, (_, i) => unit(46 + i, 46 + i)),
    ];
    const result = pickHighestRemovable(units, 20);
    expect(result.ids).toEqual([]);
    expect(result.blockedUnits).toEqual([45]);
    expect(result.removable).toBe(49);
    expect(result.removableFromTop).toBe(5);
    // and that maximum really is accepted
    expect(pickHighestRemovable(units, 5).ids).toHaveLength(5);
  });

  it("is 0 when the highest unit itself is booked", () => {
    const units = [unit(1, 1), unit(2, 2), unit(3, 3, 1)];
    const result = pickHighestRemovable(units, 1);
    expect(result.removableFromTop).toBe(0);
    expect(result.removable).toBe(2);
  });

  it("equals the unit count when nothing is booked", () => {
    expect(pickHighestRemovable([unit(1, 1), unit(2, 2)], 9).removableFromTop).toBe(2);
  });

  it("is 0 for an empty stock list", () => {
    expect(pickHighestRemovable([], 1).removableFromTop).toBe(0);
  });
});

describe("validateIdSelection", () => {
  it("accepts a selection of unbooked ids belonging to the material", () => {
    const units = [unit(1, 1), unit(2, 2), unit(3, 3)];
    const result = validateIdSelection(units, [1, 3]);
    expect(result.ids.sort()).toEqual([1, 3]);
    expect(result.blockedUnits).toEqual([]);
    expect(result.unknownIds).toEqual([]);
  });

  it("blocks the whole selection when any id references a booked unit", () => {
    const units = [unit(1, 1), unit(2, 2, 3), unit(3, 3)];
    const result = validateIdSelection(units, [1, 2, 3]);
    expect(result.ids).toEqual([]);
    expect(result.blockedUnits).toEqual([2]);
    expect(result.unknownIds).toEqual([]);
  });

  it("blocks the whole selection when an id doesn't belong to this material", () => {
    const units = [unit(1, 1), unit(2, 2)];
    const result = validateIdSelection(units, [1, 999]);
    expect(result.ids).toEqual([]);
    expect(result.unknownIds).toEqual([999]);
    expect(result.blockedUnits).toEqual([]);
  });

  it("reports both unknown and blocked ids at once", () => {
    const units = [unit(1, 1, 1)];
    const result = validateIdSelection(units, [1, 42]);
    expect(result.ids).toEqual([]);
    expect(result.blockedUnits).toEqual([1]);
    expect(result.unknownIds).toEqual([42]);
  });

  it("handles an empty ids array as a trivial success", () => {
    const units = [unit(1, 1)];
    const result = validateIdSelection(units, []);
    expect(result.ids).toEqual([]);
    expect(result.blockedUnits).toEqual([]);
    expect(result.unknownIds).toEqual([]);
  });
});

describe("nextUnitNumbers", () => {
  it("continues from the current max", () => {
    expect(nextUnitNumbers(5, 3)).toEqual([6, 7, 8]);
  });

  it("starts at 1 when there is no existing max", () => {
    expect(nextUnitNumbers(0, 2)).toEqual([1, 2]);
  });

  it("returns an empty array for count 0", () => {
    expect(nextUnitNumbers(10, 0)).toEqual([]);
  });
});
