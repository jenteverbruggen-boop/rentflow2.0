import type { PrismaClient } from "@/generated/prisma/client";

/** The supplier behind a Rentman "Inhuur <leverancier>" folder, created on first
 * sight; one that was archived is revived, since the import just told us the
 * folder is in use again. The material then defaults to it and is inhuur-only. */
export async function resolveSubhireSupplier(
  tx: PrismaClient,
  name: string,
): Promise<{ subhireOnly: true; defaultSupplierId: number }> {
  const existing = await tx.supplier.findFirst({ where: { name } });
  const supplier = existing
    ? existing.archived
      ? await tx.supplier.update({ where: { id: existing.id }, data: { archived: false } })
      : existing
    : await tx.supplier.create({ data: { name } });
  return { subhireOnly: true, defaultSupplierId: supplier.id };
}
