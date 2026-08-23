import { describe, expect, it } from "vitest";
import { resolveRemoval } from "./stock-bulk-removal";
import type { BulkUnit } from "./stock-bulk";

function unit(id: number, unitNumber: number, bookingCount = 0): BulkUnit {
  return { id, unitNumber, bookingCount };
}

const FIVE_FREE = [unit(1, 1), unit(2, 2), unit(3, 3), unit(4, 4), unit(5, 5)];

describe("resolveRemoval — by count", () => {
  it("returns the highest units for a clean request", () => {
    const out = resolveRemoval(FIVE_FREE, { count: 2 });
    expect(out).toEqual({ kind: "ok", ids: [5, 4], removedUnits: [4, 5] });
  });

  it("conflicts without deleting anything when the window hits a booked unit", () => {
    const units = [unit(1, 1), unit(2, 2), unit(3, 3), unit(4, 4, 1), unit(5, 5)];
    const out = resolveRemoval(units, { count: 3 });
    if (out.kind !== "conflict") throw new Error("expected conflict");
    expect(out.blockedUnits).toEqual([4]);
    expect(out.removable).toBe(4);
    expect(out.removableFromTop).toBe(1);
    expect(out.message).toContain("#4");
    expect(out.message).toContain("Maximaal 1");
  });

  it("omits the maximum hint when nothing at the top is removable", () => {
    const units = [unit(1, 1), unit(2, 2, 1)];
    const out = resolveRemoval(units, { count: 1 });
    if (out.kind !== "conflict") throw new Error("expected conflict");
    expect(out.removableFromTop).toBe(0);
    expect(out.message).toContain("Los die boekingen eerst op");
    expect(out.message).not.toContain("Maximaal");
  });

  it("conflicts when the material simply has fewer units than requested", () => {
    const out = resolveRemoval([unit(1, 1)], { count: 3 });
    if (out.kind !== "conflict") throw new Error("expected conflict");
    expect(out.blockedUnits).toEqual([]);
    expect(out.message).toContain("maar 1 unit");
  });
});

describe("resolveRemoval — by ids", () => {
  it("accepts a selection of free units and reports their unit numbers", () => {
    const out = resolveRemoval(FIVE_FREE, { ids: [2, 5] });
    expect(out).toEqual({ kind: "ok", ids: [2, 5], removedUnits: [2, 5] });
  });

  it("rejects the whole selection when one id is booked", () => {
    const units = [unit(1, 1), unit(2, 2, 2), unit(3, 3)];
    const out = resolveRemoval(units, { ids: [1, 2, 3] });
    if (out.kind !== "conflict") throw new Error("expected conflict");
    expect(out.blockedUnits).toEqual([2]);
    expect(out.message).toContain("Selectie verwijderen kan niet");
  });

  it("400s on an id belonging to another material", () => {
    const out = resolveRemoval(FIVE_FREE, { ids: [1, 999] });
    expect(out.kind).toBe("badRequest");
    if (out.kind !== "badRequest") throw new Error("expected badRequest");
    expect(out.message).toContain("999");
  });

  it("reports the unknown id before the booking conflict", () => {
    const units = [unit(1, 1, 1)];
    const out = resolveRemoval(units, { ids: [1, 42] });
    expect(out.kind).toBe("badRequest");
  });
});
