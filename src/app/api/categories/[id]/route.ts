import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  forbidden,
  badRequest,
  notFound,
  conflict,
  serverError,
} from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  prefix: z.string().regex(/^\d{2,4}$/, "Prefix moet 2-4 cijfers zijn"),
});

export async function PUT(req: NextRequest, { params }: Params) {
  const access = await requireModule("materialen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    const cat = await prisma.category.update({
      where: { id: parseInt(id) },
      data: parsed.data,
    });
    return NextResponse.json(cat);
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
    const cat = await prisma.category.findUnique({
      where: { id: parseInt(id) },
      include: { _count: { select: { materials: true } } },
    });
    if (!cat) return notFound();
    if (cat._count.materials > 0)
      return conflict(
        "Categorie kan niet verwijderd worden: er zijn nog materialen gekoppeld.",
      );
    await prisma.category.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
