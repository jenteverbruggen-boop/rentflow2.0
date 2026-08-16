import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { statsPeriodInclude, serializeStatsPeriod } from "@/lib/serialize-stats-period";
import { rankMaterialPayback } from "@/lib/payback";
import { toNumberOrNull, toNumber } from "@/lib/serialize";
import type { Period } from "@/types";

/**
 * K4.2 — the DB-fetching half of payback, split from the pure
 * ranking function the same way every other stats-* module is.
 * Deliberately fetches **every** period, not the requested `from`/`to`
 * range — payback is lifetime-to-date by definition (K4.1).
 */
export async function computePaybackStats(client: PrismaClient = defaultPrisma) {
  const materialRows = await client.material.findMany({
    select: { id: true, name: true, code: true, archived: true, costPrice: true, revenueBefore: true },
  });
  const materials = materialRows.map((m) => ({
    ...m,
    costPrice: toNumberOrNull(m.costPrice) ?? null,
    revenueBefore: toNumberOrNull(m.revenueBefore) ?? null,
  }));

  const stockItemRows = await client.stockItem.findMany({ select: { materialId: true, costPrice: true } });
  const stockItems = stockItemRows.map((s) => ({ ...s, costPrice: toNumberOrNull(s.costPrice) ?? null }));

  const periodRows = await client.period.findMany({ include: statsPeriodInclude });
  const periods = periodRows.map(serializeStatsPeriod) as unknown as Period[];

  const componentWeightRows = await client.periodBundleBookingComponent.findMany({
    select: { bundleBookingId: true, materialId: true, quantity: true, dayPriceAtBooking: true },
  });
  const componentWeights = componentWeightRows.map((w) => ({ ...w, dayPriceAtBooking: toNumber(w.dayPriceAtBooking) }));

  return rankMaterialPayback(materials, stockItems, periods, componentWeights);
}
