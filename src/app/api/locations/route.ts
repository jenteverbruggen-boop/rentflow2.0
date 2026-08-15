import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/api-auth";

const schema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  address: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const access = await requireModule("locaties", "lezen").catch(() => null);
  if (!access) return forbidden();
  // scope: own — deny the whole company-wide catalogue
  // (own-data-scoping-design.md §5, Locaties). The caller's own
  // project's location is visible embedded via /api/projects'
  // locationRel.
  if (access.scope === "own") return forbidden();
  try {
    const locations = await prisma.location.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { projects: true } } },
    });
    return NextResponse.json(locations);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const access = await requireModule("locaties", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    const location = await prisma.location.create({ data: parsed.data });
    return NextResponse.json(location);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
