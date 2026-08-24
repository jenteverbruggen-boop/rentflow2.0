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
import { redactMoney } from "@/lib/redact";
import { findRejectedMoneyWrite, moneyFieldsToIgnore } from "@/lib/money-write-guard";

const MATERIAL_MONEY_FIELDS = ["dayPrice", "setupCost", "bundlePriceOverride"] as const;

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
      archived,
    } = body;
    if (!name) return badRequest("naam is verplicht");

    // Compared against the persisted row, not just checked for presence
    // (money-write-guard.ts's findRejectedMoneyWrite doc comment) — MaterialForm
    // always resubmits dayPrice/setupCost/bundlePriceOverride on every
    // save, so a presence-only check would block a caller without
    // Kosten/Facturen: wijzigen from saving any material edit at all.
    const currentMaterial = await prisma.material.findUnique({
      where: { id: parseInt(id) },
      select: { dayPrice: true, setupCost: true, bundlePriceOverride: true },
    });
    if (findRejectedMoneyWrite(body, access, currentMaterial)) return forbidden();

    // Money-blind caller: MaterialForm's redacted-to-0/null echo must
    // never overwrite the persisted price — omit the key entirely so
    // Prisma leaves that column untouched (moneyFieldsToIgnore's doc
    // comment in money-write-guard.ts).
    const ignore = moneyFieldsToIgnore(access, MATERIAL_MONEY_FIELDS);
    try {
      const material = await prisma.material.update({
        where: { id: parseInt(id) },
        data: {
          name,
          category,
          categoryId: categoryId ?? null,
          code: code ?? null,
          notes,
          ...(ignore.has("dayPrice") ? {} : { dayPrice: Number(dayPrice) || 0 }),
          ...(ignore.has("setupCost")
            ? {}
            : { setupCost: setupCost != null ? Number(setupCost) : null }),
          isBundle: Boolean(isBundle),
          ...(ignore.has("bundlePriceOverride")
            ? {}
            : {
                bundlePriceOverride:
                  bundlePriceOverride != null ? Number(bundlePriceOverride) : null,
              }),
          ...(archived !== undefined ? { archived: Boolean(archived) } : {}),
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
