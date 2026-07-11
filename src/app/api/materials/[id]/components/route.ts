import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  unauthorized,
  badRequest,
  serverError,
} from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  childId: z.number().int().positive(),
  quantity: z.number().int().min(1).default(1),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    const components = await prisma.materialComponent.findMany({
      where: { parentId: parseInt(id) },
      include: { child: { include: { categoryRel: true } } },
      orderBy: { id: "asc" },
    });
    return NextResponse.json(components);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
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

    const alreadyUsed = await prisma.materialComponent.findFirst({
      where: { childId },
      include: { parent: { select: { name: true } } },
    });
    if (alreadyUsed) {
      return badRequest(
        `Dit onderdeel zit al in de set "${alreadyUsed.parent.name}" — een onderdeel kan maar in één set zitten`,
      );
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
