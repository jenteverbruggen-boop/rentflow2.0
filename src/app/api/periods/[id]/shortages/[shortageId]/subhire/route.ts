import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule, forbidden, badRequest, notFound, conflict, serverError } from "@/lib/api-auth";
import { subhireShortage, updateSubhire, undoSubhire, SubhireError } from "@/lib/subhire";
import { moneyVisible, redactMoney } from "@/lib/redact";
import { toNumberOrNull } from "@/lib/serialize";

type Params = { params: Promise<{ id: string; shortageId: string }> };

const costFields = {
  basis: z.enum(["per_huur", "per_dag"]).optional(),
  unitCost: z.number().min(0).nullable().optional(),
  costOverride: z.number().min(0).nullable().optional(),
};
const hireSchema = z.object({
  supplierId: z.number().int().positive(),
  quantity: z.number().int().positive().optional(),
  ...costFields,
});
const patchSchema = z.object({ supplierId: z.number().int().positive().optional(), ...costFields });

/** The row as the wire sees it: numbers, never raw Decimals, and the supplier's
 * prices only for a caller who may see money. */
function wire(row: Record<string, unknown>, access: Parameters<typeof redactMoney>[1]) {
  return redactMoney(
    {
      ...row,
      dayPriceSnapshot: toNumberOrNull(row.dayPriceSnapshot),
      setupCostSnapshot: toNumberOrNull(row.setupCostSnapshot),
      discountPct: toNumberOrNull(row.discountPct),
      discountAmount: toNumberOrNull(row.discountAmount),
      subhireUnitCost: toNumberOrNull(row.subhireUnitCost),
      subhireCostOverride: toNumberOrNull(row.subhireCostOverride),
    },
    access,
  );
}

function fail(err: unknown) {
  if (err instanceof SubhireError) {
    if (err.code === "NOT_FOUND") return notFound();
    if (err.code === "BAD_SUPPLIER" || err.code === "BAD_QUANTITY") return badRequest(err.message);
    return conflict(err.message);
  }
  return serverError((err as Error).message);
}

/** Without Kosten/Facturen a caller may pick the supplier but not enter what
 * the supplier charges — the material's defaults apply and their cost fields
 * are dropped rather than trusted (and never echoed back). */
function allowedCosts<T extends { basis?: unknown; unitCost?: unknown; costOverride?: unknown }>(
  body: T,
  money: boolean,
): T {
  return money ? body : { ...body, basis: undefined, unitCost: undefined, costOverride: undefined };
}

/** POST — hire (part of) an overbooked row in from a supplier. */
export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  try {
    const { id, shortageId } = await params;
    const parsed = hireSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
    const row = await subhireShortage(parseInt(id), parseInt(shortageId), allowedCosts(parsed.data, moneyVisible(access)));
    return NextResponse.json(wire(row, access), { status: 201 });
  } catch (err) {
    return fail(err);
  }
}

/** PATCH — change the supplier or the cost of a hired-in row. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  try {
    const { id, shortageId } = await params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
    const row = await updateSubhire(parseInt(id), parseInt(shortageId), allowedCosts(parsed.data, moneyVisible(access)));
    return NextResponse.json(wire(row, access));
  } catch (err) {
    return fail(err);
  }
}

/** DELETE — undo the hire: the units are an open shortage again. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  try {
    const { id, shortageId } = await params;
    return NextResponse.json(wire(await undoSubhire(parseInt(id), parseInt(shortageId)), access));
  } catch (err) {
    return fail(err);
  }
}
