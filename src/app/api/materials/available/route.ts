import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-auth";
import {
  findAvailableStockItems,
  bundleAvailableCount,
} from "@/lib/availability";
import { computeSharingMap } from "@/lib/bundle-sharing";
import { toNumber } from "@/lib/serialize";
import { parseDateRange } from "@/lib/parse-date-range";
import { redactMoney } from "@/lib/redact";

export async function GET(req: NextRequest) {
  const access = await requireModule("planning", "lezen").catch(() => null);
  if (!access) return forbidden();
  // scope: own — same reasoning as people/available/route.ts: a
  // whole-catalogue availability computation, not owned data.
  if (access.scope === "own") return forbidden();

  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const excludePeriodId = searchParams.get("excludePeriodId");
    const projectId = searchParams.get("projectId");
    const range = parseDateRange(from, to);
    if (!range) return badRequest("from en to zijn verplicht en moeten een geldige periode vormen (to na from)");

    const materials = await prisma.material.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { stockItems: true } },
        components: {
          include: {
            child: { select: { dayPrice: true, name: true } },
          },
        },
      },
    });

    const allComponents = materials.flatMap((m) =>
      m.components.map((c) => ({
        parentId: m.id,
        parentName: m.name,
        childId: c.childId,
      })),
    );
    const sharingMap = computeSharingMap(allComponents);

    const overrides = projectId
      ? await prisma.projectMaterialPrice.findMany({
          where: { projectId: parseInt(projectId) },
        })
      : [];
    const overrideMap = new Map(
      overrides.map((o) => [o.materialId, toNumber(o.dayPrice)]),
    );

    const results = await Promise.all(
      materials.map(async (m) => {
        const rangeArgs = {
          from: range.from,
          to: range.to,
          excludePeriodId: excludePeriodId
            ? parseInt(excludePeriodId)
            : undefined,
        };

        let availableCount: number;
        let availableStockItemIds: number[];
        let sharedComponents: string[] | undefined;

        if (m.isBundle) {
          availableCount = await bundleAvailableCount(m.id, rangeArgs);
          availableStockItemIds = [];
          const shared = m.components
            .filter((c) => (sharingMap.get(c.childId)?.length ?? 0) > 1)
            .map((c) => c.child.name);
          if (shared.length > 0) sharedComponents = shared;
        } else {
          const { available } = await findAvailableStockItems(m.id, rangeArgs);
          availableCount = available.length;
          availableStockItemIds = available.map((a) => a.id);
        }

        const componentSum = m.components.reduce(
          (sum, c) => sum + toNumber(c.child.dayPrice) * c.quantity,
          0,
        );
        const bundlePrice =
          m.bundlePriceOverride == null
            ? componentSum
            : toNumber(m.bundlePriceOverride);
        const basePrice = m.isBundle ? bundlePrice : toNumber(m.dayPrice);
        const effectivePrice = overrideMap.get(m.id) ?? basePrice;
        return redactMoney(
          {
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
            ...(sharedComponents ? { sharedComponents } : {}),
          },
          access,
        );
      }),
    );

    return NextResponse.json(results);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
