import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  unauthorized,
  badRequest,
  serverError,
} from "@/lib/api-auth";
import {
  findAvailableStockItems,
  bundleAvailableCount,
} from "@/lib/availability";

export async function GET(req: NextRequest) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const excludePeriodId = searchParams.get("excludePeriodId");
    const projectId = searchParams.get("projectId");
    if (!from || !to) return badRequest("from en to zijn verplicht");

    const materials = await prisma.material.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { stockItems: true } },
        components: { include: { child: { select: { dayPrice: true } } } },
      },
    });

    const overrides = projectId
      ? await prisma.projectMaterialPrice.findMany({
          where: { projectId: parseInt(projectId) },
        })
      : [];
    const overrideMap = new Map(
      overrides.map((o) => [o.materialId, Number(o.dayPrice)]),
    );

    const results = await Promise.all(
      materials.map(async (m) => {
        const rangeArgs = {
          from: new Date(from),
          to: new Date(to),
          excludePeriodId: excludePeriodId
            ? parseInt(excludePeriodId)
            : undefined,
        };

        let availableCount: number;
        let availableStockItemIds: number[];

        if (m.isBundle) {
          availableCount = await bundleAvailableCount(m.id, rangeArgs);
          availableStockItemIds = [];
        } else {
          const { available } = await findAvailableStockItems(m.id, rangeArgs);
          availableCount = available.length;
          availableStockItemIds = available.map((a) => a.id);
        }

        const componentSum = m.components.reduce(
          (sum, c) => sum + Number(c.child.dayPrice) * c.quantity,
          0,
        );
        const bundlePrice =
          m.bundlePriceOverride == null
            ? componentSum
            : Number(m.bundlePriceOverride);
        const basePrice = m.isBundle ? bundlePrice : Number(m.dayPrice);
        const effectivePrice = overrideMap.get(m.id) ?? basePrice;
        return {
          material: {
            id: m.id,
            name: m.name,
            category: m.category,
            notes: m.notes,
            dayPrice: effectivePrice,
            basePrice,
            hasOverride: overrideMap.has(m.id),
            isBundle: m.isBundle,
            code: m.code,
          },
          totalStock: m._count.stockItems,
          availableCount,
          availableStockItemIds,
        };
      }),
    );

    return NextResponse.json(results);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
