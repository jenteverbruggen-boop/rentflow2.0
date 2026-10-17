import { describe, it, expect } from "vitest";
import { billedUnits, materialLineCost, periodMaterialsCost, lineCost } from "@/lib/pricing";
import { generateDraftInvoiceLines } from "@/lib/invoice-lines";
import { groupMaterialAssignments } from "@/lib/grouping";
import type { Period, PeriodMaterialShortage, PeriodStockItem, PriceBasis } from "@/types";

const material = {
  id: 1, name: "Bord", category: null, categoryId: null, code: null, notes: null, dayPrice: 0.38,
  setupCost: null, isBundle: false, bundlePriceOverride: null, archived: false, costPrice: null, listPrice: null, revenueBefore: null,
};

function unit(id: number, price: number, basis?: PriceBasis): PeriodStockItem {
  return {
    id, periodId: 1, stockItemId: id, dayPriceSnapshot: price, ...(basis ? { priceBasisSnapshot: basis } : {}),
    setupCostSnapshot: 0, discountPct: null, discountAmount: null, bundleBookingId: null, shippedAt: null, returnedAt: null,
    stockItem: { id, materialId: 1, unitNumber: id, identifier: null, notes: null, costPrice: null, material },
  };
}

function shortage(quantity: number, price: number, basis?: PriceBasis): PeriodMaterialShortage {
  return {
    id: 50, periodId: 1, materialId: 1, quantity, bundleBookingId: null, dayPriceSnapshot: price,
    ...(basis ? { priceBasisSnapshot: basis } : {}),
    setupCostSnapshot: 0, discountPct: null, discountAmount: null, material,
  } as PeriodMaterialShortage;
}

const period = (opts: { materials?: PeriodStockItem[]; shortages?: PeriodMaterialShortage[] }): Period => ({
  id: 1, projectId: 1, name: "Event", startDate: "2026-06-01", endDate: "2026-06-03", updatedAt: "2026-06-01",
  materials: opts.materials ?? [], people: [], bundleBookings: [], shortages: opts.shortages ?? [],
});

describe("billedUnits (E1)", () => {
  it("bills once per rental, otherwise per day", () => {
    expect(billedUnits("per_huur", 3)).toBe(1);
    expect(billedUnits("per_dag", 3)).toBe(3);
    expect(billedUnits(undefined, 3)).toBe(3);
  });
  it("a per-rental owned unit costs the price once", () => {
    expect(materialLineCost(unit(1, 10, "per_huur"), 3)).toBe(10);
    expect(materialLineCost(unit(1, 10, "per_dag"), 3)).toBe(30);
    expect(materialLineCost(unit(1, 10), 3)).toBe(30);
  });
  it("a per-rental discount applies to the single price", () => {
    expect(lineCost(10, billedUnits("per_huur", 3), { discountPct: 10 })).toBe(9);
  });
});

describe("invoice lines per basis (E1)", () => {
  it("per_dag (and legacy rows without a snapshot) bill exactly as before", () => {
    const lines = generateDraftInvoiceLines([period({ materials: [unit(1, 4)], shortages: [shortage(2, 4, "per_dag")] })], {
      invoiceRole: "standalone", vatRate: 21, projectLabel: "T",
    });
    const mat = lines.filter((l) => l.kind === "material");
    expect(mat).toHaveLength(1);
    expect(mat[0]).toMatchObject({ quantity: 3, unitPrice: 12, lineTotalExcl: 36 });
  });

  it("a per_huur shortage and a per_huur owned unit share one group, billed once each", () => {
    const p = period({ materials: [unit(1, 0.38, "per_huur")], shortages: [shortage(3, 0.38, "per_huur")] });
    const groups = groupMaterialAssignments(p.materials, p.shortages ?? []);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ units: 4, priceBasis: "per_huur" });
    const lines = generateDraftInvoiceLines([p], { invoiceRole: "standalone", vatRate: 21, projectLabel: "T" });
    expect(lines.find((l) => l.kind === "material")).toMatchObject({ quantity: 4, unitPrice: 0.38, lineTotalExcl: 1.52 });
    expect(periodMaterialsCost(p)).toBe(1.52);
  });

  it("different bases never share a group", () => {
    const groups = groupMaterialAssignments([unit(1, 4, "per_dag"), unit(2, 4, "per_huur")], []);
    expect(groups).toHaveLength(2);
  });
});
