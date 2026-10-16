import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { lockMaterials } from "@/lib/booking";
import type { SubhireCostBasis } from "@/types";

export type SubhireErrorCode =
  | "NOT_FOUND" | "ALREADY_SUBHIRED" | "NOT_SUBHIRED" | "BAD_SUPPLIER" | "BAD_QUANTITY";

export class SubhireError extends Error {
  code: SubhireErrorCode;
  constructor(code: SubhireErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface SubhireArgs {
  supplierId: number;
  /** How many of the row's missing units to hire in (default: all). */
  quantity?: number;
  basis?: SubhireCostBasis;
  /** `undefined` = take the material's default; `null` = no cost known. */
  unitCost?: number | null;
  costOverride?: number | null;
}

async function loadRow(tx: PrismaClient, shortageId: number, periodId: number) {
  const row = await tx.periodMaterialShortage.findUnique({
    where: { id: shortageId },
    include: { material: true },
  });
  if (!row || row.periodId !== periodId) throw new SubhireError("NOT_FOUND", "Overboeking niet gevonden");
  return row;
}

async function assertUsableSupplier(tx: PrismaClient, supplierId: number) {
  const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier || supplier.archived) throw new SubhireError("BAD_SUPPLIER", "Kies een leverancier die nog actief is");
}

/**
 * Resolves (part of) an overbooked row by hiring the units in from a
 * supplier. The row then stops being an open shortage — it no longer blocks
 * confirming or invoicing — and keeps being billed to the client at the same
 * price. A partial quantity splits the row: the hired-in part becomes its own
 * resolved row, the rest stays open. Unit price and basis default to the
 * material's. Runs under the material lock, like every booking write.
 */
export async function subhireShortage(
  periodId: number,
  shortageId: number,
  args: SubhireArgs,
  client: PrismaClient = defaultPrisma,
) {
  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    const peek = await loadRow(txClient, shortageId, periodId);
    await lockMaterials(txClient, [peek.materialId]);
    const row = await loadRow(txClient, shortageId, periodId);
    if (row.supplierId != null) throw new SubhireError("ALREADY_SUBHIRED", "Dit is al ingehuurd");
    await assertUsableSupplier(txClient, args.supplierId);

    const quantity = args.quantity ?? row.quantity;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > row.quantity) {
      throw new SubhireError("BAD_QUANTITY", `Aantal moet tussen 1 en ${row.quantity} liggen`);
    }
    const resolved = {
      supplierId: args.supplierId,
      subhiredAt: new Date(),
      subhireCostBasis: args.basis ?? (row.material.subhireCostBasis as SubhireCostBasis),
      subhireUnitCost: args.unitCost === undefined ? row.material.subhireUnitCost : args.unitCost,
      subhireCostOverride: args.costOverride ?? null,
    };

    if (quantity === row.quantity) {
      return txClient.periodMaterialShortage.update({ where: { id: row.id }, data: resolved });
    }
    await txClient.periodMaterialShortage.update({ where: { id: row.id }, data: { quantity: row.quantity - quantity } });
    return txClient.periodMaterialShortage.create({
      data: {
        periodId: row.periodId, materialId: row.materialId, bundleBookingId: row.bundleBookingId, quantity,
        dayPriceSnapshot: row.dayPriceSnapshot, setupCostSnapshot: row.setupCostSnapshot,
        discountPct: row.discountPct, discountAmount: row.discountAmount, ...resolved,
      },
    });
  });
}

/** Change a hired-in row's supplier or cost. */
export async function updateSubhire(
  periodId: number,
  shortageId: number,
  patch: Partial<Omit<SubhireArgs, "quantity">>,
  client: PrismaClient = defaultPrisma,
) {
  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    const row = await loadRow(txClient, shortageId, periodId);
    if (row.supplierId == null) throw new SubhireError("NOT_SUBHIRED", "Dit is niet ingehuurd");
    if (patch.supplierId !== undefined) await assertUsableSupplier(txClient, patch.supplierId);
    return txClient.periodMaterialShortage.update({
      where: { id: row.id },
      data: {
        supplierId: patch.supplierId,
        subhireCostBasis: patch.basis,
        subhireUnitCost: patch.unitCost,
        subhireCostOverride: patch.costOverride,
      },
    });
  });
}

/** Back to an open shortage (the supplier fell through). Folded into an
 * existing open row of the same material/price so rows don't pile up. */
export async function undoSubhire(periodId: number, shortageId: number, client: PrismaClient = defaultPrisma) {
  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    const peek = await loadRow(txClient, shortageId, periodId);
    await lockMaterials(txClient, [peek.materialId]);
    const row = await loadRow(txClient, shortageId, periodId);
    if (row.supplierId == null) throw new SubhireError("NOT_SUBHIRED", "Dit is niet ingehuurd");

    const open = await txClient.periodMaterialShortage.findFirst({
      where: {
        id: { not: row.id }, periodId: row.periodId, materialId: row.materialId,
        bundleBookingId: row.bundleBookingId, dayPriceSnapshot: row.dayPriceSnapshot,
        discountPct: row.discountPct, discountAmount: row.discountAmount, supplierId: null,
      },
    });
    if (open) {
      await txClient.periodMaterialShortage.update({ where: { id: open.id }, data: { quantity: open.quantity + row.quantity } });
      await txClient.periodMaterialShortage.delete({ where: { id: row.id } });
      return open;
    }
    return txClient.periodMaterialShortage.update({
      where: { id: row.id },
      data: { supplierId: null, subhiredAt: null, subhireCostBasis: null, subhireUnitCost: null, subhireCostOverride: null },
    });
  });
}
