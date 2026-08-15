import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  badRequest,
  forbidden,
  serverError,
} from "@/lib/api-auth";
import { toNumber } from "@/lib/serialize";
import { findRejectedMoneyWrite, redactMoney } from "@/lib/redact";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const access = await requireModule("personen", "wijzigen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { id } = await params;
    const body = await req.json();
    const {
      name,
      role,
      email,
      phone,
      dayPrice,
      address,
      postalCode,
      city,
      country,
      functionIds,
    } = body;
    if (!name) return badRequest("naam is verplicht");

    if (findRejectedMoneyWrite(body, access)) return forbidden();

    const person = await prisma.person.update({
      where: { id: parseInt(id) },
      data: {
        name,
        role,
        email,
        phone,
        dayPrice: Number(dayPrice) || 0,
        address,
        postalCode,
        city,
        country,
        functions:
          functionIds !== undefined
            ? {
                deleteMany: {},
                create: (functionIds as number[]).map((fid) => ({
                  functionId: fid,
                })),
              }
            : undefined,
      },
      include: { functions: { include: { function: true } } },
    });
    return NextResponse.json(
      redactMoney(
        {
          ...person,
          dayPrice: toNumber(person.dayPrice),
          functions: person.functions.map((f) => f.function),
        },
        access,
      ),
    );
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("personen", "verwijderen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { id } = await params;
    await prisma.person.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
