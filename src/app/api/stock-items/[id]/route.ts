import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, conflict, serverError } from "@/lib/api-auth";
import { redactMoney } from "@/lib/redact";
import { toNumberOrNull } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await requireModule("materialen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  try {
    const { id } = await params;
    const { identifier, notes } = await req.json();
    const item = await prisma.stockItem.update({
      where: { id: parseInt(id) },
      data: { identifier: identifier ?? null, notes: notes ?? null },
    });
    // Review finding: this route only ever writes identifier/notes but
    // echoed the whole updated row, including costPrice, with no
    // redaction at all — the sibling GET (materials/[id]/stock-items)
    // already redacts it correctly.
    return NextResponse.json(redactMoney({ ...item, costPrice: toNumberOrNull(item.costPrice) }, access));
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("materialen", "verwijderen").catch(() => null);
  if (!access) return forbidden();
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
