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
  contactName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const access = await requireModule("klanten", "lezen").catch(() => null);
  if (!access) return forbidden();
  // scope: own — deny the whole company-wide catalogue
  // (own-data-scoping-design.md §5, Klanten). The caller's own
  // project's client is visible embedded via /api/projects' clientRel.
  if (access.scope === "own") return forbidden();
  try {
    const clients = await prisma.client.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { projects: true } } },
    });
    return NextResponse.json(clients);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const access = await requireModule("klanten", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    const { email, ...rest } = parsed.data;
    const client = await prisma.client.create({
      data: { ...rest, email: email || null },
    });
    return NextResponse.json(client);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
