import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule, forbidden, badRequest, notFound, serverError } from "@/lib/api-auth";
import { createAdhocSubhire, AdhocSubhireError } from "@/lib/adhoc-subhire";
import { moneyWritable } from "@/lib/redact";
import { toNumber } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().trim().min(1, "Naam is verplicht"),
  supplierId: z.number().int().positive(),
  quantity: z.number().int().min(1, "Aantal moet minstens 1 zijn"),
  dayPrice: z.number().min(0).optional(),
  priceBasis: z.enum(["per_dag", "per_huur"]).optional(),
  unitCost: z.number().min(0).nullable().optional(),
  costBasis: z.enum(["per_huur", "per_dag"]).optional(),
});

/** POST — create an inhuur-only catalogue item and hire it in for this period
 * in one go. Needs both planning and catalogue write access, because it adds
 * a material. Prices are only taken from a caller who may write money. */
export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  const catalogue = await requireModule("materialen", "wijzigen").catch(() => null);
  if (!catalogue || access.scope === "own") return forbidden();
  try {
    const { id } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
    const money = moneyWritable(access);
    const { dayPrice, priceBasis, unitCost, costBasis, ...rest } = parsed.data;
    const result = await createAdhocSubhire(parseInt(id), {
      ...rest,
      ...(money ? { dayPrice, priceBasis, unitCost, costBasis } : {}),
    });
    return NextResponse.json(
      { materialId: result.material.id, name: result.material.name, dayPrice: toNumber(result.material.dayPrice), warnings: result.warnings },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AdhocSubhireError) {
      if (err.code === "NOT_FOUND") return notFound();
      if (err.code === "NAME_TAKEN") return NextResponse.json({ error: err.message, materialId: err.materialId }, { status: 409 });
      return badRequest(err.message);
    }
    return serverError((err as Error).message);
  }
}
