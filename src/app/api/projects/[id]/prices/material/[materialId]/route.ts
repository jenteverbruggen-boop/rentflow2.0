import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, serverError } from "@/lib/api-auth";
import { toNumber, toNumberOrNull } from "@/lib/serialize";

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
    const override = await prisma.projectMaterialPrice.upsert({
      where: { projectId_materialId: { projectId, materialId: matId } },
      create: { projectId, materialId: matId, dayPrice: price },
      update: { dayPrice: price },
      include: { material: true },
    });
    await prisma.periodStockItem.updateMany({
      where: { period: { projectId }, stockItem: { materialId: matId } },
      data: { dayPriceSnapshot: price },
    });
    return NextResponse.json({
      ...override,
      dayPrice: toNumber(override.dayPrice),
      material: {
        ...override.material,
        dayPrice: toNumber(override.material.dayPrice),
        setupCost: toNumberOrNull(override.material.setupCost),
        bundlePriceOverride: toNumberOrNull(override.material.bundlePriceOverride),
      },
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
    await prisma.projectMaterialPrice.deleteMany({
      where: { projectId, materialId: matId },
    });
    const material = await prisma.material.findUnique({ where: { id: matId } });
    if (material) {
      await prisma.periodStockItem.updateMany({
        where: { period: { projectId }, stockItem: { materialId: matId } },
        data: { dayPriceSnapshot: toNumber(material.dayPrice) },
      });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
