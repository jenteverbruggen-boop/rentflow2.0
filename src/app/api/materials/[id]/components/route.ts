import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-auth";
import { redactMoney } from "@/lib/redact";
import { toNumber, toNumberOrNull } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  childId: z.number().int().positive(),
  quantity: z.number().int().min(1).default(1),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const access = await requireModule("materialen", "lezen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    const { id } = await params;
    const components = await prisma.materialComponent.findMany({
      where: { parentId: parseInt(id) },
      include: { child: { include: { categoryRel: true } } },
      orderBy: { id: "asc" },
    });
    // Not flagged in the brief's own route table for redaction, but
    // component.child carries the same dayPrice/setupCost/
    // bundlePriceOverride leak shape as materials/[id]/stock-items —
    // closing it here for consistency. Review finding: the child's
    // Decimal fields also need converting before redactMoney — that
    // function only nulls them for a caller without access, it's a
    // no-op (raw Decimal, not a number) for one that does have access.
    return NextResponse.json(
      components.map((c) =>
        redactMoney(
          {
            ...c,
            child: {
              ...c.child,
              dayPrice: toNumber(c.child.dayPrice),
              setupCost: toNumberOrNull(c.child.setupCost),
              bundlePriceOverride: toNumberOrNull(c.child.bundlePriceOverride),
            },
          },
          access,
        ),
      ),
    );
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireModule("materialen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    const { id } = await params;
    const parentId = parseInt(id);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    const { childId, quantity } = parsed.data;

    if (childId === parentId) {
      return badRequest("Een set kan zichzelf niet als component bevatten");
    }
    const child = await prisma.material.findUnique({ where: { id: childId } });
    if (!child) return badRequest("Component bestaat niet");
    if (child.isBundle) {
      return badRequest("Een set kan geen andere set als component bevatten");
    }

    const component = await prisma.materialComponent.create({
      data: { parentId, childId, quantity },
      include: { child: true },
    });
    // Review finding: this response had no redaction at all — any
    // caller regardless of Kosten/Facturen access received the raw
    // (and unconverted, on Postgres) child.dayPrice/setupCost/
    // bundlePriceOverride.
    return NextResponse.json(
      redactMoney(
        {
          ...component,
          child: {
            ...component.child,
            dayPrice: toNumber(component.child.dayPrice),
            setupCost: toNumberOrNull(component.child.setupCost),
            bundlePriceOverride: toNumberOrNull(component.child.bundlePriceOverride),
          },
        },
        access,
      ),
    );
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return badRequest("Dit component zit al in de set");
    }
    return serverError((err as Error).message);
  }
}
