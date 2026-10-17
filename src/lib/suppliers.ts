import { prisma } from "@/lib/prisma";

export interface SupplierInput {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  vatNumber?: string | null;
  notes?: string | null;
  archived?: boolean;
}

/** A supplier that materials or hired-in rows still point at can't be deleted;
 * archive it instead (it then drops out of the pickers but history stays). */
export class SupplierInUseError extends Error {
  constructor() {
    super("Deze leverancier is nog in gebruik — archiveer hem in plaats van te verwijderen");
  }
}

export const listSuppliers = (includeArchived: boolean) =>
  prisma.supplier.findMany({
    where: includeArchived ? {} : { archived: false },
    orderBy: { name: "asc" },
  });

export async function deleteSupplier(id: number): Promise<void> {
  const [materials, shortages] = await Promise.all([
    prisma.material.count({ where: { defaultSupplierId: id } }),
    prisma.periodMaterialShortage.count({ where: { supplierId: id } }),
  ]);
  if (materials + shortages > 0) throw new SupplierInUseError();
  try {
    await prisma.supplier.delete({ where: { id } });
  } catch (e: unknown) {
    // A hire landed between the count and the delete (FK restrict).
    if ((e as { code?: string })?.code === "P2003" || (e as { code?: string })?.code === "P2014") throw new SupplierInUseError();
    throw e;
  }
}
