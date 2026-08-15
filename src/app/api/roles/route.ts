import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, conflict, serverError } from "@/lib/api-auth";

const createSchema = z.object({
  key: z.string().min(1, "Sleutel is verplicht").regex(/^[A-Z0-9_]+$/, "Alleen hoofdletters, cijfers en underscores"),
  label: z.string().min(1, "Naam is verplicht"),
});

export async function GET() {
  const auth = await requireModule("gebruikers", "lezen").catch(() => null);
  if (!auth) return forbidden();

  try {
    const roles = await prisma.role.findMany({
      select: {
        id: true,
        key: true,
        label: true,
        isSystem: true,
        scope: true,
        _count: { select: { users: true } },
      },
      orderBy: { id: "asc" },
    });
    return NextResponse.json(roles);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireModule("gebruikers", "wijzigen").catch(() => null);
  if (!auth) return forbidden();

  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const exists = await prisma.role.findUnique({ where: { key: parsed.data.key } });
    if (exists) return conflict("Er bestaat al een rol met deze sleutel");

    // New custom roles start with no RolePermission rows — every module
    // resolves to "geen" (satisfies()'s fallback) until the PO configures
    // the matrix in N3.2. This does not contradict C1: the fully-open seed
    // is specifically about the deployment's three system roles, not every
    // future custom role.
    const role = await prisma.role.create({
      data: { key: parsed.data.key, label: parsed.data.label, isSystem: false, scope: "all" },
    });
    return NextResponse.json(role);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
