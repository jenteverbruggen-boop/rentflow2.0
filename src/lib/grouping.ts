import type { Material, PeriodStockItem } from "@/types";

export interface MaterialGroup {
  key: string;
  material: Material;
  units: number;
  dayPriceSnapshot: number;
  discountPct: number | null;
  discountAmount: number | null;
  assignments: PeriodStockItem[];
}

function groupKey(a: PeriodStockItem): string {
  return [
    a.stockItem.materialId,
    a.dayPriceSnapshot,
    a.discountPct ?? "x",
    a.discountAmount ?? "x",
  ].join("|");
}

export function groupMaterialAssignments(materials: PeriodStockItem[]): MaterialGroup[] {
  const map = new Map<string, MaterialGroup>();
  for (const a of materials) {
    const k = groupKey(a);
    const existing = map.get(k);
    if (existing) {
      existing.units += 1;
      existing.assignments.push(a);
    } else {
      map.set(k, {
        key: k,
        material: a.stockItem.material,
        units: 1,
        dayPriceSnapshot: a.dayPriceSnapshot,
        discountPct: a.discountPct,
        discountAmount: a.discountAmount,
        assignments: [a],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.material.name.localeCompare(b.material.name));
}
