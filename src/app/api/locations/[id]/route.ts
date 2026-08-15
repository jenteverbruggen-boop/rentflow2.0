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
  address: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const access = await requireModule("locaties", "lezen").catch(() => null);
  if (!access) return forbidden();
  try {
    const { id } = await params;
    const loc = await prisma.location.findUnique({
      where: { id: parseInt(id) },
      include: { _count: { select: { projects: true } } },
    });
    if (!loc) return notFound();
    return NextResponse.json(loc);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const access = await requireModule("locaties", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    const loc = await prisma.location.update({
      where: { id: parseInt(id) },
      data: parsed.data,
    });
    return NextResponse.json(loc);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("locaties", "verwijderen").catch(() => null);
  if (!access) return forbidden();
  try {
    const { id } = await params;
    const count = await prisma.project.count({
      where: { locationId: parseInt(id) },
    });
    if (count > 0)
      return conflict(
        "Locatie kan niet verwijderd worden: er zijn nog projecten gekoppeld.",
      );
    await prisma.location.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
