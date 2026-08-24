import { toNumber, toNumberOrNull } from "@/lib/serialize";

/**
 * Builds the Prisma `data` fragment for Material's six money fields
 * (dayPrice/setupCost/bundlePriceOverride/costPrice/listPrice/
 * revenueBefore), skipping any field in `ignore` (moneyFieldsToIgnore) —
 * a money-blind caller's redacted-to-0/null echo must never overwrite a
 * real persisted value. Shared between POST /api/materials and PUT
 * /api/materials/[id] so the six near-identical conditionals (and their
 * cognitive-complexity cost) live in one place instead of being repeated
 * per route.
 *
 * dayPrice keeps Material's own schema default of 0 when absent/invalid;
 * the other five stay `null` when unset rather than defaulting to 0 —
 * payback.ts (K4) relies on `costPrice == null` meaning "unknown, exclude
 * from the ranking" rather than "known to be zero".
 */
export function materialMoneyData(body: Record<string, unknown>, ignore: Set<string>) {
  const num = (key: string) => (body[key] != null ? Number(body[key]) : null);
  return {
    ...(ignore.has("dayPrice") ? {} : { dayPrice: Number(body.dayPrice) || 0 }),
    ...(ignore.has("setupCost") ? {} : { setupCost: num("setupCost") }),
    ...(ignore.has("bundlePriceOverride") ? {} : { bundlePriceOverride: num("bundlePriceOverride") }),
    ...(ignore.has("costPrice") ? {} : { costPrice: num("costPrice") }),
    ...(ignore.has("listPrice") ? {} : { listPrice: num("listPrice") }),
    ...(ignore.has("revenueBefore") ? {} : { revenueBefore: num("revenueBefore") }),
  };
}

/**
 * The read-side counterpart: converts a Material row's six Decimal money
 * columns to plain numbers (or null) for the JSON response. Never spread
 * a raw Prisma row into a response without this — `Decimal.toJSON()`
 * returns a string, so an unconverted field is fine on SQLite (dev) but
 * silently becomes a string on Postgres (prod). See the "Money rule" in
 * CLAUDE.md.
 */
export function serializeMaterialMoney(material: {
  dayPrice: unknown;
  setupCost: unknown;
  bundlePriceOverride: unknown;
  costPrice: unknown;
  listPrice: unknown;
  revenueBefore: unknown;
}) {
  return {
    dayPrice: toNumber(material.dayPrice),
    setupCost: toNumberOrNull(material.setupCost),
    bundlePriceOverride: toNumberOrNull(material.bundlePriceOverride),
    costPrice: toNumberOrNull(material.costPrice),
    listPrice: toNumberOrNull(material.listPrice),
    revenueBefore: toNumberOrNull(material.revenueBefore),
  };
}
