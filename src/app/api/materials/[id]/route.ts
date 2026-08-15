import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  unauthorized,
  badRequest,
  notFound,
  conflict,
  serverError,
} from "@/lib/api-auth";
import { toNumber, toNumberOrNull } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    const material = await prisma.material.findUnique({
      where: { id: parseInt(id) },
      include: { stockItems: { orderBy: { unitNumber: "asc" } } },
    });
    if (!material) return notFound();
    return NextResponse.json({
      ...material,
      dayPrice: toNumber(material.dayPrice),
      setupCost: toNumberOrNull(material.setupCost),
      bundlePriceOverride: toNumberOrNull(material.bundlePriceOverride),
      totalStock: material.stockItems.length,
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const {
      name,
      category,
      categoryId,
      code,
      dayPrice,
      setupCost,
      notes,
      isBundle,
      bundlePriceOverride,
    } = await req.json();
    if (!name) return badRequest("naam is verplicht");
    try {
      const material = await prisma.material.update({
        where: { id: parseInt(id) },
        data: {
          name,
          category,
          categoryId: categoryId ?? null,
          code: code ?? null,
          notes,
          dayPrice: Number(dayPrice) || 0,
          setupCost: setupCost != null ? Number(setupCost) : null,
          isBundle: Boolean(isBundle),
          bundlePriceOverride:
            bundlePriceOverride != null ? Number(bundlePriceOverride) : null,
        },
        include: { categoryRel: true },
      });
      return NextResponse.json({
        ...material,
        dayPrice: toNumber(material.dayPrice),
        setupCost: toNumberOrNull(material.setupCost),
        bundlePriceOverride: toNumberOrNull(material.bundlePriceOverride),
      });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002")
        return conflict("Code bestaat al");
      throw e;
    }
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    await prisma.material.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
