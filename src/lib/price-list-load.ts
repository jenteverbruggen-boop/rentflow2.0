import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { buildPriceList, type PriceList, type PriceListOptions } from "@/lib/price-list";

export interface LoadedPriceList extends PriceList {
  clientName: string | null;
}

/** Loads what a price list needs and builds it. Archived materials and
 * functions never appear; sets keep their components so the set price is
 * computed by the same helper the booking uses. */
export async function loadPriceList(
  opts: PriceListOptions,
  client: PrismaClient = defaultPrisma,
): Promise<LoadedPriceList> {
  const [materials, functions, rates, clientRow, btw] = await Promise.all([
    client.material.findMany({
      where: { archived: false },
      select: {
        name: true, code: true, category: true, categoryId: true, isBundle: true, priceBasis: true,
        dayPrice: true, setupCost: true, bundlePriceOverride: true,
        categoryRel: { select: { name: true } },
        components: { select: { quantity: true, child: { select: { dayPrice: true } } } },
      },
    }),
    opts.includeCrew
      ? client.function.findMany({
          where: { archived: false },
          select: { id: true, name: true, dayRate: true, hourRate: true },
        })
      : Promise.resolve([]),
    opts.includeCrew && opts.clientId != null
      ? client.clientFunctionRate.findMany({
          where: { clientId: opts.clientId },
          select: { functionId: true, dayRate: true, hourRate: true },
        })
      : Promise.resolve([]),
    opts.clientId != null
      ? client.client.findUnique({ where: { id: opts.clientId }, select: { name: true } })
      : Promise.resolve(null),
    client.setting.findUnique({ where: { key: "btwRate" } }),
  ]);

  const list = buildPriceList(
    materials.map((m) => ({ ...m, categoryName: m.categoryRel?.name ?? null })),
    functions,
    new Map(rates.map((r) => [r.functionId, r])),
    opts,
    Number(btw?.value) || 21,
  );
  return { ...list, clientName: clientRow?.name ?? null };
}
