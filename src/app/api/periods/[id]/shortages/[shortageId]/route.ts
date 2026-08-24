import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, notFound, serverError } from "@/lib/api-auth";
import { toNumber, toNumberOrNull } from "@/lib/serialize";

type Params = { params: Promise<{ shortageId: string }> };

const schema = z.object({ quantity: z.coerce.number().int().min(0) });

/** Overboeken — lets the min-button on a material-group row take an
 * overbooked unit away before it touches a real assignment. `quantity: 0`
 * deletes the row outright, same as the DELETE below. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "wijzigen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { shortageId } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Ongeldige invoer");

    const existing = await prisma.periodMaterialShortage.findUnique({
      where: { id: parseInt(shortageId) },
    });
    if (!existing) return notFound();

    if (parsed.data.quantity === 0) {
      await prisma.periodMaterialShortage.delete({ where: { id: existing.id } });
      return NextResponse.json({ success: true, deleted: true });
    }

    const updated = await prisma.periodMaterialShortage.update({
      where: { id: existing.id },
      data: { quantity: parsed.data.quantity },
    });
    return NextResponse.json({
      ...updated,
      dayPriceSnapshot: toNumber(updated.dayPriceSnapshot),
      setupCostSnapshot: toNumber(updated.setupCostSnapshot),
      discountPct: toNumberOrNull(updated.discountPct),
      discountAmount: toNumberOrNull(updated.discountAmount),
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "verwijderen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { shortageId } = await params;
    await prisma.periodMaterialShortage.delete({ where: { id: parseInt(shortageId) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
