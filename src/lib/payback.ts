import { groupMaterialAssignments, materialGroupCost } from "@/lib/grouping";
import { periodDays } from "@/lib/pricing";
import { toNumber } from "@/lib/serialize";
import type { Period } from "@/types";

export interface PaybackMaterial {
  id: number;
  name: string;
  code: string | null;
  archived: boolean;
  costPrice: number | null;
  revenueBefore: number | null;
}

export interface PaybackStockItem {
  materialId: number;
  costPrice: number | null;
}

/** One row per component per bundle booking — DDL-3's
 * PeriodBundleBookingComponent, the only place a set's per-component
 * weight is ever recorded. */
export interface BundleComponentWeight {
  bundleBookingId: number;
  materialId: number;
  quantity: number;
  dayPriceAtBooking: number;
}

export interface PaybackResult {
  materialId: number;
  name: string;
  code: string | null;
  earned: number;
  costBasis: number;
  paybackPct: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * K4.1 — "did I pay off the fridge, and what percentage?" Lifetime-
 * to-date by definition (no date range parameter — payback means
 * something different from "this month", per the PO's own framing).
 * Pure function, no Prisma import: operates over already-fetched data
 * (compute-payback.ts owns the DB access).
 */
export function computeMaterialPayback(
  material: PaybackMaterial,
  stockItems: PaybackStockItem[],
  periods: Period[],
  componentWeights: BundleComponentWeight[],
): PaybackResult | null {
  if (material.archived) return null;

  const ownStockItems = stockItems.filter((s) => s.materialId === material.id);
  const perUnitCosts = ownStockItems.map((s) => s.costPrice ?? material.costPrice);
  if (material.costPrice == null && perUnitCosts.every((c) => c == null)) {
    return null; // no cost price known anywhere — excluded, never shown as 0%
  }
  const costBasis = perUnitCosts.reduce((sum: number, c) => sum + (c ?? 0), 0);

  const flatRevenue = flatRevenueFor(material.id, periods);
  const bundleRevenue = bundleShareFor(material.id, periods, componentWeights);
  const earned = (material.revenueBefore ?? 0) + flatRevenue + bundleRevenue;

  return {
    materialId: material.id,
    name: material.name,
    code: material.code,
    earned: round(earned),
    costBasis: round(costBasis),
    paybackPct: costBasis > 0 ? round((earned / costBasis) * 100 * 100) / 100 : 0,
  };
}

/** Flat revenue only — bundled component lines are always snapshotted
 * at `dayPriceSnapshot: 0` (booking.ts), so they must never be read
 * here; `!bundleBookingId` is the exact predicate `grouping.ts`'s own
 * `groupMaterialAssignmentsNested` uses for the same purpose. */
function flatRevenueFor(materialId: number, periods: Period[]): number {
  let revenue = 0;
  for (const period of periods) {
    const days = periodDays(period);
    const flatItems = period.materials.filter((m) => !m.bundleBookingId);
    for (const group of groupMaterialAssignments(flatItems)) {
      if (group.material.id === materialId) revenue += materialGroupCost(group, days);
    }
  }
  return revenue;
}

/** Reconstructs a bundle booking's revenue split pro-rata by the
 * weight snapshotted at booking time — never the live Material.dayPrice,
 * which would silently rewrite historical attribution on a later price
 * change. All-weights-zero falls back to an equal split. */
function bundleShareFor(materialId: number, periods: Period[], weights: BundleComponentWeight[]): number {
  let revenue = 0;
  for (const period of periods) {
    const days = periodDays(period);
    for (const booking of period.bundleBookings ?? []) {
      const componentWeights = weights.filter((w) => w.bundleBookingId === booking.id);
      const thisWeight = componentWeights.find((w) => w.materialId === materialId);
      if (!thisWeight) continue;

      const totalWeight = componentWeights.reduce((s, w) => s + w.dayPriceAtBooking * w.quantity, 0);
      const bundleLineTotal = toNumber(booking.dayPriceSnapshot) * booking.quantity * days;
      revenue +=
        totalWeight === 0
          ? bundleLineTotal / componentWeights.length
          : bundleLineTotal * ((thisWeight.dayPriceAtBooking * thisWeight.quantity) / totalWeight);
    }
  }
  return revenue;
}

export function rankMaterialPayback(
  materials: PaybackMaterial[],
  stockItems: PaybackStockItem[],
  periods: Period[],
  componentWeights: BundleComponentWeight[],
): { best: PaybackResult[]; worst: PaybackResult[] } {
  const results = materials
    .map((m) => computeMaterialPayback(m, stockItems, periods, componentWeights))
    .filter((r): r is PaybackResult => r != null);
  const sorted = [...results].sort((a, b) => b.paybackPct - a.paybackPct);
  return { best: sorted.slice(0, 10), worst: sorted.slice(-10).reverse() };
}
