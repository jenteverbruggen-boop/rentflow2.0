import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-auth";
import { nextCode } from "@/lib/material-code";
import { toNumber, toNumberOrNull } from "@/lib/serialize";
import { findRejectedMoneyWrite, redactMoney } from "@/lib/redact";
import { serializeMaterialsList } from "@/lib/materials-list";

export async function GET(req: NextRequest) {
  const access = await requireModule("materialen", "lezen").catch(() => null);
  if (!access) return forbidden();

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
        usedInBundles: {
          include: { parent: { select: { id: true, name: true } } },
        },
      },
    });

    return NextResponse.json(serializeMaterialsList(materials, access));
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const access = await requireModule("materialen", "wijzigen").catch(() => null);
  if (!access) return forbidden();

  try {
    const body = await req.json();
    if (findRejectedMoneyWrite(body, access)) return forbidden();
    const {
      name,
      category,
      categoryId,
      code: manualCode,
      dayPrice,
      setupCost,
      notes,
      initialStock,
    } = body;
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
        setupCost: setupCost != null ? Number(setupCost) : null,
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
    return NextResponse.json(
      redactMoney(
        {
          ...material,
          dayPrice: toNumber(material.dayPrice),
          setupCost: toNumberOrNull(material.setupCost),
          totalStock: stock,
        },
        access,
      ),
    );
  } catch (err) {
    return serverError((err as Error).message);
  }
}
