import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  resolveCurrentAccess,
  unauthorized,
  badRequest,
  serverError,
} from "@/lib/api-auth";
import { toNumber } from "@/lib/serialize";
import { redactMoney } from "@/lib/redact";

export async function GET() {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const access = await resolveCurrentAccess();
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
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
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
    } = await req.json();
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
    const access = await resolveCurrentAccess();
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
