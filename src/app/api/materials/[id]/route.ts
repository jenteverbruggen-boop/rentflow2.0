import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  badRequest,
  forbidden,
  notFound,
  conflict,
  serverError,
} from "@/lib/api-auth";
import { toNumber, toNumberOrNull } from "@/lib/serialize";
import { findRejectedMoneyWrite, redactMoney } from "@/lib/redact";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const access = await requireModule("materialen", "lezen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    const { id } = await params;
    const material = await prisma.material.findUnique({
      where: { id: parseInt(id) },
      include: { stockItems: { orderBy: { unitNumber: "asc" } } },
    });
    if (!material) return notFound();
    return NextResponse.json(
      redactMoney(
        {
          ...material,
          dayPrice: toNumber(material.dayPrice),
          setupCost: toNumberOrNull(material.setupCost),
          bundlePriceOverride: toNumberOrNull(material.bundlePriceOverride),
          totalStock: material.stockItems.length,
        },
        access,
      ),
    );
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const access = await requireModule("materialen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id } = await params;
    const body = await req.json();
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
    } = body;
    if (!name) return badRequest("naam is verplicht");

    if (findRejectedMoneyWrite(body, access)) return forbidden();

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
      return NextResponse.json(
        redactMoney(
          {
            ...material,
            dayPrice: toNumber(material.dayPrice),
            setupCost: toNumberOrNull(material.setupCost),
            bundlePriceOverride: toNumberOrNull(material.bundlePriceOverride),
          },
          access,
        ),
      );
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
  const access = await requireModule("materialen", "verwijderen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id } = await params;
    await prisma.material.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
