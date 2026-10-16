import { describe, it, expect } from "vitest";
import { computeSubhireStats } from "@/lib/stats-subhire";
import type { Period, PeriodMaterialShortage } from "@/types";

const shortage = (over: Partial<PeriodMaterialShortage>): PeriodMaterialShortage => ({
  id: 1, periodId: 1, materialId: 1, quantity: 4, bundleBookingId: null, dayPriceSnapshot: 5, setupCostSnapshot: 0,
  discountPct: null, discountAmount: null, supplierId: 7, subhireCostBasis: "per_huur", subhireUnitCost: 2,
  subhireCostOverride: null, material: { id: 1, name: "Bord" } as never, ...over,
});
const period = (shortages: PeriodMaterialShortage[]): Period =>
  ({ id: 1, projectId: 1, name: "P", startDate: "2026-06-01", endDate: "2026-06-02", updatedAt: "x", materials: [], people: [], shortages }) as unknown as Period;

describe("computeSubhireStats (C3)", () => {
  it("revenue is what the client pays, cost what the supplier charges, margin the difference", () => {
    // 2 days: revenue 4 × €5 × 2 = 40; cost per huur 4 × €2 = 8
    expect(computeSubhireStats([period([shortage({})])])).toEqual({ revenue: 40, cost: 8, margin: 32, rows: 1, unpricedRows: 0 });
  });

  it("a per-day cost multiplies by the period's days", () => {
    const s = computeSubhireStats([period([shortage({ subhireCostBasis: "per_dag" })])]);
    expect(s.cost).toBe(16);
  });

  it("open shortages are not inhuur: they have no supplier and no known cost", () => {
    expect(computeSubhireStats([period([shortage({ supplierId: null })])])).toMatchObject({ rows: 0, revenue: 0, cost: 0 });
  });

  it("a row without a price is counted as unpriced, not as free", () => {
    const s = computeSubhireStats([period([shortage({ subhireUnitCost: null })])]);
    expect(s).toMatchObject({ rows: 1, cost: 0, unpricedRows: 1 });
  });
});
