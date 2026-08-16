import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, serverError, notFound } from "@/lib/api-auth";
import { effectiveMaterialPrice } from "@/lib/effective-price";
import { toNumber, toNumberOrNull } from "@/lib/serialize";
import { findRejectedField, redactMoney } from "@/lib/redact";
import { resolvePackingListPatch } from "@/lib/packing-list";

const KOSTEN_FIELDS = ["discountPct", "discountAmount", "resnapshotPrice"] as const;

type Params = { params: Promise<{ id: string; assignmentId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "wijzigen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { assignmentId } = await params;
    const body = await req.json();
    if (findRejectedField(body, access, KOSTEN_FIELDS)) return forbidden();
    const { resnapshotPrice, discountPct, discountAmount, shipped, returned } = body;
    const data: Record<string, unknown> = {};
    if (resnapshotPrice) {
      const current = await prisma.periodStockItem.findUnique({
        where: { id: parseInt(assignmentId) },
        include: { stockItem: true, period: true },
      });
      if (!current) return notFound();
      const price = await effectiveMaterialPrice(
        current.period.projectId,
        current.stockItem.materialId
      );
      data.dayPriceSnapshot = price.amount;
    }
    if (discountPct !== undefined) data.discountPct = discountPct != null ? toNumber(discountPct) : null;
    if (discountAmount !== undefined) data.discountAmount = discountAmount != null ? toNumber(discountAmount) : null;

    // Packing-list checklist — server stamps "now" itself, the same
    // convention as every other snapshot-at-action-time field in this
    // codebase (dayPriceSnapshot, rateSnapshot, etc.); never trusts a
    // client-supplied timestamp.
    if (shipped !== undefined || returned !== undefined) {
      const existing = await prisma.periodStockItem.findUnique({
        where: { id: parseInt(assignmentId) },
        select: { shippedAt: true },
      });
      if (!existing) return notFound();
      const patch = resolvePackingListPatch(
        { shipped, returned, currentlyShipped: existing.shippedAt != null },
        new Date(),
      );
      if (patch.error) return badRequest(patch.error);
      Object.assign(data, patch.data);
    }

    const updated = await prisma.periodStockItem.update({
      where: { id: parseInt(assignmentId) },
      data,
      include: { stockItem: { include: { material: true } } },
    });
    return NextResponse.json(
      redactMoney(
        {
          ...updated,
          dayPriceSnapshot: toNumber(updated.dayPriceSnapshot),
          setupCostSnapshot: toNumberOrNull(updated.setupCostSnapshot),
          discountPct: toNumberOrNull(updated.discountPct),
          discountAmount: toNumberOrNull(updated.discountAmount),
          stockItem: {
            ...updated.stockItem,
            material: {
              ...updated.stockItem.material,
              dayPrice: toNumber(updated.stockItem.material.dayPrice),
              setupCost: toNumberOrNull(updated.stockItem.material.setupCost),
              bundlePriceOverride: toNumberOrNull(
                updated.stockItem.material.bundlePriceOverride,
              ),
            },
          },
        },
        access,
      ),
    );
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "verwijderen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { assignmentId } = await params;
    await prisma.periodStockItem.delete({ where: { id: parseInt(assignmentId) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
