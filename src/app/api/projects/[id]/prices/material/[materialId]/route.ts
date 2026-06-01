import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, serverError } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string; materialId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { id, materialId } = await params;
    const projectId = parseInt(id);
    const matId = parseInt(materialId);
    const { dayPrice } = await req.json();
    if (dayPrice == null || Number(dayPrice) < 0) return badRequest("dayPrice >= 0 is verplicht");

    const price = Number(dayPrice);
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
    return NextResponse.json(override);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

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
        data: { dayPriceSnapshot: Number(material.dayPrice) },
      });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
