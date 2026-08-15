import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, serverError, notFound } from "@/lib/api-auth";
import { effectiveMaterialPrice } from "@/lib/effective-price";
import { toNumber, toNumberOrNull } from "@/lib/serialize";
import { findRejectedField, redactMoney } from "@/lib/redact";

const KOSTEN_FIELDS = ["discountPct", "discountAmount", "resnapshotPrice"] as const;

type Params = { params: Promise<{ id: string; assignmentId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "wijzigen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { assignmentId } = await params;
    const body = await req.json();
    if (findRejectedField(body, access, KOSTEN_FIELDS)) return forbidden();
    const { resnapshotPrice, discountPct, discountAmount } = body;
    const data: Record<string, unknown> = {};
    if (resnapshotPrice) {
      const current = await prisma.periodStockItem.findUnique({
        where: { id: parseInt(assignmentId) },
        include: { stockItem: true, period: true },
      });
      if (!current) return notFound();
      data.dayPriceSnapshot = await effectiveMaterialPrice(
        current.period.projectId,
        current.stockItem.materialId
      );
    }
    if (discountPct !== undefined) data.discountPct = discountPct != null ? toNumber(discountPct) : null;
    if (discountAmount !== undefined) data.discountAmount = discountAmount != null ? toNumber(discountAmount) : null;
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
