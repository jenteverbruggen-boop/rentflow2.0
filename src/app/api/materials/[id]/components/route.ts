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

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  childId: z.number().int().positive(),
  quantity: z.number().int().min(1).default(1),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const access = await requireModule("materialen", "lezen").catch(() => null);
  if (!access) return forbidden();
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
    // closing it here for consistency.
    return NextResponse.json(
      components.map((c) => redactMoney(c, access)),
    );
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireModule("materialen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
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
    return NextResponse.json(component);
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return badRequest("Dit component zit al in de set");
    }
    return serverError((err as Error).message);
  }
}
