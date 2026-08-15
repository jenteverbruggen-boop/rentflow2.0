import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-auth";
import { findRejectedField, redactMoney } from "@/lib/redact";

const RATE_FIELDS = ["dayRate", "hourRate"] as const;

const schema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  dayRate: z.coerce.number().nonnegative().nullable().optional(),
  hourRate: z.coerce.number().nonnegative().nullable().optional(),
});

// L1.1: resolves the phase-1 TODO(L1) markers — dayRate/hourRate landed
// on Function in DDL-2, redacted here for callers without
// Kosten/Facturen: lezen and rejected on write without :wijzigen.
export async function GET() {
  const access = await requireModule("personen", "lezen").catch(() => null);
  if (!access) return forbidden();
  // scope: own — deny the standalone catalogue; function names for the
  // caller's own crew still arrive embedded via PeriodPerson.role
  // (own-data-scoping-design.md §5, Personen).
  if (access.scope === "own") return forbidden();
  try {
    const functions = await prisma.function.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(functions.map((f) => redactMoney(f, access)));
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const access = await requireModule("personen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    if (findRejectedField(body, access, RATE_FIELDS)) {
      return forbidden();
    }
    const fn = await prisma.function.create({ data: parsed.data });
    return NextResponse.json(redactMoney(fn, access));
  } catch (err) {
    return serverError((err as Error).message);
  }
}
