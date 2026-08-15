import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-auth";
import { toNumber } from "@/lib/serialize";
import { findRejectedMoneyWrite, redactMoney } from "@/lib/redact";

export async function GET() {
  const access = await requireModule("personen", "lezen").catch(() => null);
  if (!access) return forbidden();

  try {
    const people = await prisma.person.findMany({
      orderBy: { name: "asc" },
      include: { functions: { include: { function: true } } },
    });
    return NextResponse.json(
      people.map((p) =>
        redactMoney(
          {
            ...p,
            dayPrice: toNumber(p.dayPrice),
            functions: p.functions.map((f) => f.function),
          },
          access,
        ),
      ),
    );
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const access = await requireModule("personen", "wijzigen").catch(() => null);
  if (!access) return forbidden();

  try {
    const body = await req.json();
    if (findRejectedMoneyWrite(body, access)) return forbidden();
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
    const person = await prisma.person.create({
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
        functions: functionIds?.length
          ? {
              create: (functionIds as number[]).map((id) => ({
                functionId: id,
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
