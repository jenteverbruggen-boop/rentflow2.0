import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-auth";
import { toNumber } from "@/lib/serialize";
import { findRejectedMoneyWrite, redactMoney } from "@/lib/redact";

// L1.1: the only person-entity route with no zod schema before this —
// every other entity route in the codebase validates with one.
export const personSchema = z.object({
  name: z.string().min(1, "naam is verplicht"),
  role: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  dayPrice: z.coerce.number().optional(),
  address: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  functionIds: z.array(z.number().int()).optional(),
});

export async function GET() {
  const access = await requireModule("personen", "lezen").catch(() => null);
  if (!access) return forbidden();
  // scope: own — Person carries no project/period FK, so there is no
  // "my own people" query to express; deny the whole standalone
  // catalogue outright (own-data-scoping-design.md §5, Personen). Crew
  // on the caller's own periods is visible embedded via /api/projects.
  if (access.scope === "own") return forbidden();

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
  // Already unreachable for scope: own (requireModule's read-only rule,
  // N5.1) — kept explicit for the same reason as GET above: one
  // identical, mechanically reviewable rule everywhere in this file.
  if (access.scope === "own") return forbidden();

  try {
    const body = await req.json();
    if (findRejectedMoneyWrite(body, access)) return forbidden();
    const parsed = personSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    const { name, role, email, phone, dayPrice, address, postalCode, city, country, functionIds } = parsed.data;
    const person = await prisma.person.create({
      data: {
        name,
        role,
        email,
        phone,
        dayPrice: dayPrice ?? 0,
        address,
        postalCode,
        city,
        country,
        functions: functionIds?.length
          ? {
              create: functionIds.map((id) => ({ functionId: id })),
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
