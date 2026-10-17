import { NextRequest, NextResponse } from "next/server";
import { setProjectMaterialPrice, clearProjectMaterialPrice } from "@/lib/project-material-price";
import { requireModule, forbidden, badRequest, serverError } from "@/lib/api-auth";
import { toNumber } from "@/lib/serialize";
import { serializeMaterialMoney } from "@/lib/material-money-fields";

type Params = { params: Promise<{ id: string; materialId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "wijzigen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { id, materialId } = await params;
    const projectId = parseInt(id);
    const matId = parseInt(materialId);
    const { dayPrice } = await req.json();
    if (dayPrice == null || Number(dayPrice) < 0) return badRequest("dayPrice >= 0 is verplicht");

    const price = toNumber(dayPrice);
    const override = await setProjectMaterialPrice(projectId, matId, price);
    return NextResponse.json({
      ...override,
      dayPrice: toNumber(override.dayPrice),
      // Every money column, not just the three the UI reads: a raw Decimal
      // reaches the wire as a string in production (CLAUDE.md money rule).
      material: { ...override.material, ...serializeMaterialMoney(override.material) },
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "verwijderen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { id, materialId } = await params;
    const projectId = parseInt(id);
    const matId = parseInt(materialId);
    await clearProjectMaterialPrice(projectId, matId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
