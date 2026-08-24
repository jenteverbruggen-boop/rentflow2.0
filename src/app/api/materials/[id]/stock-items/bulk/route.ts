import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  forbidden,
  badRequest,
  conflict,
  serverError,
} from "@/lib/api-auth";
import type { PrismaClient } from "@/generated/prisma/client";
import { lockMaterials } from "@/lib/booking";
import { nextUnitNumbers, type BulkUnit } from "@/lib/stock-bulk";
import { resolveRemoval } from "@/lib/stock-bulk-removal";
import type { StockBulkAddResult, StockBulkRemoveResult } from "@/types";

type Params = { params: Promise<{ id: string }> };

const addSchema = z.object({
  count: z.number().int().min(1).max(500),
});

const removeSchema = z.union([
  z.object({ count: z.number().int().min(1).max(500) }),
  z.object({ ids: z.array(z.number().int().positive()).min(1).max(500) }),
]);

export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireModule("materialen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    const { id } = await params;
    const materialId = parseInt(id);
    const parsed = addSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    const { count } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      await lockMaterials(tx as unknown as PrismaClient, [materialId]);
      const last = await tx.stockItem.findFirst({
        where: { materialId },
        orderBy: { unitNumber: "desc" },
      });
      const numbers = nextUnitNumbers(last?.unitNumber ?? 0, count);
      await tx.stockItem.createMany({
        data: numbers.map((unitNumber) => ({
          materialId,
          unitNumber,
          identifier: null,
          notes: null,
        })),
      });
      return {
        added: count,
        fromUnit: numbers[0],
        toUnit: numbers[numbers.length - 1],
      } satisfies StockBulkAddResult;
    });

    return NextResponse.json(result);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const access = await requireModule("materialen", "verwijderen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    const { id } = await params;
    const materialId = parseInt(id);
    const parsed = removeSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    // The read of each unit's booking count and the delete itself must be
    // one atomic step under the same advisory lock bookFlatMaterial /
    // bookBundleMaterial take (src/lib/booking.ts): PeriodStockItem
    // cascades on stockItem delete, so a booking landing between the two
    // would be silently destroyed by the delete instead of blocking it.
    const outcome = await prisma.$transaction(async (tx) => {
      const txClient = tx as unknown as PrismaClient;
      await lockMaterials(txClient, [materialId]);
      const rows = await txClient.stockItem.findMany({
        where: { materialId },
        select: { id: true, unitNumber: true, _count: { select: { assignments: true } } },
      });
      const units: BulkUnit[] = rows.map((r) => ({
        id: r.id,
        unitNumber: r.unitNumber,
        bookingCount: r._count.assignments,
      }));
      const resolved = resolveRemoval(units, parsed.data);
      if (resolved.kind === "ok") {
        await txClient.stockItem.deleteMany({ where: { id: { in: resolved.ids } } });
      }
      return resolved;
    });

    if (outcome.kind === "badRequest") return badRequest(outcome.message);
    if (outcome.kind === "conflict") {
      return conflict(outcome.message, {
        blockedUnits: outcome.blockedUnits,
        removable: outcome.removable,
        removableFromTop: outcome.removableFromTop,
      });
    }

    return NextResponse.json({
      removed: outcome.ids.length,
      removedUnits: outcome.removedUnits,
    } satisfies StockBulkRemoveResult);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
