import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  unauthorized,
  badRequest,
  serverError,
} from "@/lib/api-auth";
import { nextCode } from "@/lib/material-code";
import { computeBundleStock } from "@/lib/bundle-stock";

export async function GET(req: NextRequest) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const code = new URL(req.url).searchParams.get("code");
    const materials = await prisma.material.findMany({
      orderBy: { name: "asc" },
      where: code ? { code } : undefined,
      include: {
        _count: { select: { stockItems: true } },
        categoryRel: true,
        components: {
          include: {
            child: {
              select: {
                id: true,
                name: true,
                code: true,
                dayPrice: true,
                _count: { select: { stockItems: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      materials.map((m) => {
        const base = { ...m, totalStock: m._count.stockItems };
        if (!m.isBundle) return base;
        const bundleStock = computeBundleStock(
          m.components.map((c) => ({
            childId: c.childId,
            name: c.child.name,
            code: c.child.code,
            needPerSet: c.quantity,
            totalStock: c.child._count.stockItems,
            dayPrice: Number(c.child.dayPrice),
          })),
        );
        const setPrice =
          m.bundlePriceOverride != null
            ? Number(m.bundlePriceOverride)
            : bundleStock.componentSum;
        return { ...base, bundleStock, setPrice };
      }),
    );
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const {
      name,
      category,
      categoryId,
      code: manualCode,
      dayPrice,
      notes,
      initialStock,
    } = await req.json();
    if (!name) return badRequest("naam is verplicht");

    let code: string | null = manualCode ?? null;
    if (!code && categoryId) {
      const cat = await prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (cat) {
        const existing = await prisma.material.findMany({
          where: { code: { not: null } },
          select: { code: true },
        });
        const codes = existing.map((m) => m.code as string);
        try {
          code = nextCode(cat.prefix, codes);
        } catch {
          code = null;
        }
      }
    }

    const material = await prisma.material.create({
      data: {
        name,
        category,
        categoryId: categoryId ?? null,
        code,
        notes,
        dayPrice: Number(dayPrice) || 0,
      },
      include: { categoryRel: true },
    });
    const stock = Math.max(0, parseInt(initialStock) || 0);
    if (stock > 0) {
      await prisma.stockItem.createMany({
        data: Array.from({ length: stock }, (_, i) => ({
          materialId: material.id,
          unitNumber: i + 1,
        })),
      });
    }
    return NextResponse.json({ ...material, totalStock: stock });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
