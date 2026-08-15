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
import { findRejectedField, redactMoney } from "@/lib/redact";

type Params = { params: Promise<{ id: string }> };
const RATE_FIELDS = ["dayRate", "hourRate"] as const;

const schema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  dayRate: z.coerce.number().nonnegative().nullable().optional(),
  hourRate: z.coerce.number().nonnegative().nullable().optional(),
});

// L1.1: resolves the phase-1 TODO(L1) markers on this file.
export async function PUT(req: NextRequest, { params }: Params) {
  const access = await requireModule("personen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    if (findRejectedField(body, access, RATE_FIELDS)) {
      return forbidden();
    }
    const fn = await prisma.function.update({
      where: { id: parseInt(id) },
      data: parsed.data,
    });
    return NextResponse.json(redactMoney(fn, access));
  } catch (err) {
    return serverError((err as Error).message);
  }
}

// dayRate/hourRate need no redaction here — this handler never returns
// the function row on success.
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
