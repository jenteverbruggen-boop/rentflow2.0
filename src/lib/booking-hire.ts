import type { PrismaClient } from "@/generated/prisma/client";
import { resolveBookingSubhire, type ShortageSubhire, type SubhireRequest } from "@/lib/subhire-defaults";

type HireMaterial = Parameters<typeof resolveBookingSubhire>[0];

export interface BookingHires {
  /** For a flat material: hire what is short from this supplier. */
  flatHire: ShortageSubhire | null;
  /** For a set: per missing component. */
  componentHire: Map<number, ShortageSubhire | null>;
  hiresIn: boolean;
}

/**
 * Hiring in while booking: an inhuur-only material always is (from its default
 * supplier); any other only when the caller named a supplier. That is also the
 * one way past the stock ceiling in a confirmed project — the excess is not an
 * open shortage, it is already resolved. Returns an error message when a
 * supplier involved is gone or archived.
 */
export async function resolveBookingHires(
  prisma: PrismaClient,
  material: HireMaterial & { isBundle: boolean; components: { childId: number; child: HireMaterial }[] },
  request: SubhireRequest | undefined,
  canSetCosts: boolean,
): Promise<{ hires: BookingHires; error: string | null }> {
  const componentHire = new Map(
    material.components.map((c) => [c.childId, resolveBookingSubhire(c.child, request, canSetCosts)]),
  );
  const flatHire = material.isBundle ? null : resolveBookingSubhire(material, request, canSetCosts);
  const suppliers = new Set(
    [flatHire?.supplierId, ...[...componentHire.values()].map((h) => h?.supplierId)].filter((v): v is number => v != null),
  );
  let error: string | null = null;
  if (suppliers.size > 0) {
    const active = await prisma.supplier.count({ where: { id: { in: [...suppliers] }, archived: false } });
    if (active !== suppliers.size) error = "Kies een leverancier die nog actief is";
  }
  return { hires: { flatHire, componentHire, hiresIn: suppliers.size > 0 }, error };
}
