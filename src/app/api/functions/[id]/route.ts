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
const schema = z.object({ name: z.string().min(1, "Naam is verplicht") });

// TODO(L1): phase 2 adds Function.dayRate/hourRate — reject those two
// fields on write for callers without Kosten/Facturen: wijzigen.
export async function PUT(req: NextRequest, { params }: Params) {
  const access = await requireModule("personen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    const fn = await prisma.function.update({
      where: { id: parseInt(id) },
      data: parsed.data,
    });
    return NextResponse.json(fn);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

// TODO(L1): phase 2 adds Function.dayRate/hourRate — no redaction needed
// here, this handler never returns the function row on success.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("personen", "verwijderen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    const { id } = await params;
    const fn = await prisma.function.findUnique({
      where: { id: parseInt(id) },
      include: { _count: { select: { people: true } } },
    });
    if (!fn) return notFound();
    if (fn._count.people > 0)
      return conflict(
        "Functie kan niet verwijderd worden: er zijn nog personen gekoppeld.",
      );
    await prisma.function.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
