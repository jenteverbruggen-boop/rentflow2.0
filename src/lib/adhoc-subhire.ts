import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { bookFlatMaterialTx } from "@/lib/booking";
import { nextCodeForCategory } from "@/lib/material-code-db";
import type { PriceBasis, SubhireCostBasis } from "@/types";

export const ADHOC_CATEGORY = "Inhuur";
const ADHOC_CATEGORY_PREFIX = "9990";

export type AdhocErrorCode = "NOT_FOUND" | "BAD_SUPPLIER" | "NAME_TAKEN" | "BAD_INPUT";

export class AdhocSubhireError extends Error {
  code: AdhocErrorCode;
  /** NAME_TAKEN: the existing active material with that name. */
  materialId?: number;
  constructor(code: AdhocErrorCode, message: string, materialId?: number) {
    super(message);
    this.code = code;
    this.materialId = materialId;
  }
}

export interface AdhocSubhireInput {
  name: string;
  supplierId: number;
  quantity: number;
  /** What the client pays (money users only; otherwise 0). */
  dayPrice?: number;
  priceBasis?: PriceBasis;
  /** What the supplier charges (money users only). */
  unitCost?: number | null;
  costBasis?: SubhireCostBasis;
}

/**
 * Ad-hoc inhuur from the picker: creates an inhuur-only catalogue item
 * (category "Inhuur", created when missing) and books it in the period in one
 * transaction, every unit hired in from the supplier. Because nothing is ever
 * left as an open shortage this works in every project status. The item stays
 * in the catalogue for reuse. A name clash with an active material is refused
 * so the caller can offer to use that one.
 */
export async function createAdhocSubhire(
  periodId: number,
  input: AdhocSubhireInput,
  client: PrismaClient = defaultPrisma,
) {
  const name = input.name.trim();
  if (!name) throw new AdhocSubhireError("BAD_INPUT", "Naam is verplicht");
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new AdhocSubhireError("BAD_INPUT", "Aantal moet minstens 1 zijn");

  const category = await findOrCreateCategory(client);
  return client.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaClient;
    const period = await txClient.period.findUnique({ where: { id: periodId } });
    if (!period) throw new AdhocSubhireError("NOT_FOUND", "Periode niet gevonden");
    const supplier = await txClient.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier || supplier.archived) throw new AdhocSubhireError("BAD_SUPPLIER", "Kies een leverancier die nog actief is");
    const clash = await txClient.material.findFirst({ where: { name, archived: false }, select: { id: true } });
    if (clash) throw new AdhocSubhireError("NAME_TAKEN", `Er bestaat al een materiaal met de naam "${name}"`, clash.id);

    const code = await nextCodeForCategory(txClient, category.id);
    const priceBasis = input.priceBasis ?? "per_huur";
    const costBasis = input.costBasis ?? "per_huur";
    const dayPrice = input.dayPrice ?? 0;
    const unitCost = input.unitCost ?? null;
    const material = await txClient.material.create({
      data: {
        name, code, category: category.name, categoryId: category.id, dayPrice, priceBasis,
        subhireOnly: true, defaultSupplierId: supplier.id, subhireUnitCost: unitCost, subhireCostBasis: costBasis,
      },
    });

    const booked = await bookFlatMaterialTx(txClient, {
      periodId, materialId: material.id, materialName: name, quantity: input.quantity,
      from: period.startDate, to: period.endDate, dayPriceSnapshot: dayPrice, priceBasis, setupCostSnapshot: 0,
      allowOverbook: true,
      subhire: { supplierId: supplier.id, basis: costBasis, unitCost, costOverride: null },
    });
    return { material, warnings: booked.warnings };
  });
}

/** Outside the transaction on purpose: a unique clash inside one would abort
 * it on Postgres. Two people creating the first ad-hoc item race here. */
async function findOrCreateCategory(client: PrismaClient) {
  const find = () => client.category.findFirst({ where: { name: ADHOC_CATEGORY } });
  const existing = await find();
  if (existing) return existing;
  try {
    return await client.category.create({ data: { name: ADHOC_CATEGORY, prefix: ADHOC_CATEGORY_PREFIX } });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      const again = await find();
      if (again) return again;
    }
    throw err;
  }
}
