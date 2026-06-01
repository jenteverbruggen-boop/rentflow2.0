import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, conflict, serverError } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    const { identifier, notes } = await req.json();
    const item = await prisma.stockItem.update({
      where: { id: parseInt(id) },
      data: { identifier: identifier ?? null, notes: notes ?? null },
    });
    return NextResponse.json(item);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    const stockItemId = parseInt(id);
    const used = await prisma.periodStockItem.count({ where: { stockItemId } });
    if (used > 0) return conflict(`Deze unit is nog geboekt op ${used} periode(s)`);
    await prisma.stockItem.delete({ where: { id: stockItemId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
