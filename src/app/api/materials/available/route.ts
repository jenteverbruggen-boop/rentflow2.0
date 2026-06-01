import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, serverError } from "@/lib/api-auth";
import { findAvailableStockItems } from "@/lib/availability";

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
      include: { _count: { select: { stockItems: true } } },
    });

    const overrides = projectId
      ? await prisma.projectMaterialPrice.findMany({ where: { projectId: parseInt(projectId) } })
      : [];
    const overrideMap = new Map(overrides.map((o) => [o.materialId, Number(o.dayPrice)]));

    const results = await Promise.all(
      materials.map(async (m) => {
        const { available } = await findAvailableStockItems(m.id, {
          from: new Date(from),
          to: new Date(to),
          excludePeriodId: excludePeriodId ? parseInt(excludePeriodId) : undefined,
        });
        const basePrice = Number(m.dayPrice);
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
          },
          totalStock: m._count.stockItems,
          availableCount: available.length,
          availableStockItemIds: available.map((a) => a.id),
        };
      })
    );

    return NextResponse.json(results);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
