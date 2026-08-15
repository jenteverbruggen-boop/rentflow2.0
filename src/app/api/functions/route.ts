import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-auth";

const schema = z.object({ name: z.string().min(1, "Naam is verplicht") });

// TODO(L1): phase 2 adds Function.dayRate/hourRate — redact those two
// fields here for callers without Kosten/Facturen: lezen once they exist.
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
    return NextResponse.json(functions);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

// TODO(L1): phase 2 adds Function.dayRate/hourRate — reject those two
// fields on write for callers without Kosten/Facturen: wijzigen.
export async function POST(req: NextRequest) {
  const access = await requireModule("personen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    const fn = await prisma.function.create({ data: parsed.data });
    return NextResponse.json(fn);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
