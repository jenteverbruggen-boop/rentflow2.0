import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, serverError } from "@/lib/api-auth";
import { listSuppliers } from "@/lib/suppliers";
import { supplierSchema } from "@/lib/supplier-schema";

/** Suppliers belong to the materials domain (you rent material from them);
 * a scoped (freelancer) caller never sees the list — their contact details
 * and the fact that something is hired in are commercial information. */
export async function GET(req: NextRequest) {
  const access = await requireModule("materialen", "lezen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    const includeArchived = new URL(req.url).searchParams.get("includeArchived") === "true";
    return NextResponse.json(await listSuppliers(includeArchived));
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const access = await requireModule("materialen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    const parsed = supplierSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
    return NextResponse.json(await prisma.supplier.create({ data: parsed.data }), { status: 201 });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
