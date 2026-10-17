import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, notFound, conflict, serverError } from "@/lib/api-auth";
import { deleteSupplier, SupplierInUseError } from "@/lib/suppliers";
import { supplierSchema } from "@/lib/supplier-schema";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const access = await requireModule("materialen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    const { id } = await params;
    const parsed = supplierSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
    if (!(await prisma.supplier.findUnique({ where: { id: parseInt(id) } }))) return notFound();
    // Archiving a supplier that inhuur-only materials still default to would
    // make those materials impossible to book.
    if (parsed.data.archived === true && (await prisma.material.count({ where: { defaultSupplierId: parseInt(id), archived: false } })) > 0) {
      return conflict("Deze leverancier is de standaardleverancier van een materiaal — kies eerst een andere");
    }
    return NextResponse.json(await prisma.supplier.update({ where: { id: parseInt(id) }, data: parsed.data }));
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("materialen", "verwijderen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();
  try {
    const { id } = await params;
    await deleteSupplier(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof SupplierInUseError) return conflict(err.message);
    return serverError((err as Error).message);
  }
}
