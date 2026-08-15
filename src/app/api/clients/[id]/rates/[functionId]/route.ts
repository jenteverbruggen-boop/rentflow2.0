import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  forbidden,
  badRequest,
  notFound,
  serverError,
} from "@/lib/api-auth";
import { toNumberOrNull } from "@/lib/serialize";
import { redactMoney } from "@/lib/redact";

type Params = { params: Promise<{ id: string; functionId: string }> };

const schema = z.object({
  dayRate: z.coerce.number().nonnegative().nullable().optional(),
  hourRate: z.coerce.number().nonnegative().nullable().optional(),
});

export async function PUT(req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id, functionId } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const existing = await prisma.clientFunctionRate.findUnique({
      where: { clientId_functionId: { clientId: parseInt(id), functionId: parseInt(functionId) } },
    });
    if (!existing) return notFound();

    const rate = await prisma.clientFunctionRate.update({
      where: { id: existing.id },
      data: parsed.data,
      include: { function: { select: { id: true, name: true } } },
    });
    return NextResponse.json(
      redactMoney(
        {
          id: rate.id,
          clientId: rate.clientId,
          functionId: rate.functionId,
          dayRate: toNumberOrNull(rate.dayRate),
          hourRate: toNumberOrNull(rate.hourRate),
          function: rate.function,
        },
        access,
      ),
    );
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "verwijderen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id, functionId } = await params;
    const existing = await prisma.clientFunctionRate.findUnique({
      where: { clientId_functionId: { clientId: parseInt(id), functionId: parseInt(functionId) } },
    });
    if (!existing) return notFound();
    await prisma.clientFunctionRate.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
