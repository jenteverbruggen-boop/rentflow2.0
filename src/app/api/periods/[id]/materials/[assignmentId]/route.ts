import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, serverError, notFound } from "@/lib/api-auth";
import { effectiveMaterialPrice } from "@/lib/effective-price";

type Params = { params: Promise<{ id: string; assignmentId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { assignmentId } = await params;
    const { resnapshotPrice, discountPct, discountAmount } = await req.json();
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
    if (discountPct !== undefined) data.discountPct = discountPct != null ? Number(discountPct) : null;
    if (discountAmount !== undefined) data.discountAmount = discountAmount != null ? Number(discountAmount) : null;
    const updated = await prisma.periodStockItem.update({
      where: { id: parseInt(assignmentId) },
      data,
      include: { stockItem: { include: { material: true } } },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { assignmentId } = await params;
    await prisma.periodStockItem.delete({ where: { id: parseInt(assignmentId) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
