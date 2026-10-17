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
    expect(computeSubhireStats([period([shortage({})])])).toEqual({
      revenue: { agreed: 40, pending: 0 }, cost: { agreed: 8, pending: 0 }, margin: { agreed: 32, pending: 0 },
      rows: 1, unpricedRows: 0, componentCost: { agreed: 0, pending: 0 },
    });
  });

  it("a per-day cost multiplies by the period's days", () => {
    const s = computeSubhireStats([period([shortage({ subhireCostBasis: "per_dag" })])]);
    expect(s.cost.agreed).toBe(16);
  });

  it("open shortages are not inhuur: they have no supplier and no known cost", () => {
    expect(computeSubhireStats([period([shortage({ supplierId: null })])])).toMatchObject({ rows: 0, revenue: { agreed: 0 }, cost: { agreed: 0 } });
  });

  it("a row without a price is counted as unpriced, not as free", () => {
    const s = computeSubhireStats([period([shortage({ subhireUnitCost: null })])]);
    expect(s).toMatchObject({ rows: 1, cost: { agreed: 0 }, unpricedRows: 1 });
  });

  it("a hired-in component whose set can't be found has no revenue, but its cost still counts (D2)", () => {
    const s = computeSubhireStats([period([shortage({ bundleBookingId: 5, dayPriceSnapshot: 0 })])]);
    expect(s).toMatchObject({ rows: 1, revenue: { agreed: 0 }, cost: { agreed: 8 }, margin: { agreed: -8 }, componentCost: { agreed: 8 } });
  });
});

describe("computeSubhireStats buckets (D1)", () => {
  it("splits revenue, cost and margin by the project's bucket", () => {
    const concept = { ...period([shortage({})]), bucket: "teBevestigen" as const };
    const agreed = { ...period([shortage({ id: 2, quantity: 2 })]), bucket: "afgesproken" as const };
    const s = computeSubhireStats([concept, agreed]);
    expect(s.revenue).toEqual({ agreed: 20, pending: 40 });
    expect(s.cost).toEqual({ agreed: 4, pending: 8 });
    expect(s.margin).toEqual({ agreed: 16, pending: 32 });
    expect(s.rows).toBe(2);
  });
});
