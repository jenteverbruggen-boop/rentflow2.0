import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, notFound, conflict, serverError } from "@/lib/api-auth";
import { toNumber, toNumberOrNull } from "@/lib/serialize";

type Params = { params: Promise<{ id: string; shortageId: string }> };

// Either set the row's quantity, or take `decrement` units off it (the
// min-button takes ONE unit; it must not delete the whole row).
const schema = z
  .object({
    quantity: z.coerce.number().int().min(0).optional(),
    decrement: z.coerce.number().int().min(1).optional(),
  })
  .refine((v) => (v.quantity === undefined) !== (v.decrement === undefined), {
    message: "Geef quantity of decrement op",
  });

/** Overboeken — lets the min-button on a material-group row take an
 * overbooked unit away before it touches a real assignment. `quantity: 0`
 * deletes the row outright, same as the DELETE below. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "wijzigen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { id, shortageId } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Ongeldige invoer");

    const existing = await prisma.periodMaterialShortage.findUnique({
      where: { id: parseInt(shortageId) },
    });
    // The row must belong to the period in the URL.
    if (!existing || existing.periodId !== parseInt(id)) return notFound();
    // A hired-in row is a supplier booking: it is changed or undone through
    // its own subhire endpoint, never by the overbook min-button.
    if (existing.supplierId != null) return conflict("Dit materiaal is ingehuurd — pas de inhuur aan");

    const quantity = parsed.data.quantity ?? existing.quantity - (parsed.data.decrement ?? 0);
    // The writes carry `supplierId: null` too: a hire that lands between the
    // read above and here must not be overwritten or deleted by the min-button.
    if (quantity <= 0) {
      const gone = await prisma.periodMaterialShortage.deleteMany({ where: { id: existing.id, supplierId: null } });
      if (gone.count === 0) return conflict("Dit materiaal is ondertussen ingehuurd — pas de inhuur aan");
      return NextResponse.json({ success: true, deleted: true });
    }

    const changed = await prisma.periodMaterialShortage.updateMany({
      where: { id: existing.id, supplierId: null },
      data: { quantity },
    });
    if (changed.count === 0) return conflict("Dit materiaal is ondertussen ingehuurd — pas de inhuur aan");
    const updated = await prisma.periodMaterialShortage.findUniqueOrThrow({ where: { id: existing.id } });
    return NextResponse.json({
      ...updated,
      subhireUnitCost: undefined,
      subhireCostOverride: undefined,
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
    const { id, shortageId } = await params;
    const existing = await prisma.periodMaterialShortage.findUnique({ where: { id: parseInt(shortageId) } });
    if (!existing || existing.periodId !== parseInt(id)) return notFound();
    if (existing.supplierId != null) return conflict("Dit materiaal is ingehuurd — maak de inhuur eerst ongedaan");
    const gone = await prisma.periodMaterialShortage.deleteMany({ where: { id: existing.id, supplierId: null } });
    if (gone.count === 0) return conflict("Dit materiaal is ondertussen ingehuurd — maak de inhuur eerst ongedaan");
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
