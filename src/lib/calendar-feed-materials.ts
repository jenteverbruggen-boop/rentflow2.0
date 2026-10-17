import type { PrismaClient } from "@/generated/prisma/client";

/** One material on a period, already counted. `isSet` marks a booked set
 * (its component units are never listed — the set stands for them). */
export interface MaterialEntry {
  materialId: number;
  name: string;
  category: string | null;
  quantity: number;
  isSet: boolean;
}

/** Longest material list in an event description; the rest is "… en N meer"
 * so a big festival can't bloat the feed or get cut off by a client. */
export const MAX_MATERIAL_LINES = 25;

/**
 * "3x Tent 6x3" lines for one period, grouped per material (units booked at
 * different prices still count as one line), sorted by category then name.
 * Names and quantities only — never prices, notes or stock identifiers: the
 * feed URL carries no permissions, so it may only show what every crew
 * member on the job is allowed to see.
 */
export function summarizePeriodMaterials(entries: MaterialEntry[]): string[] {
  const merged = new Map<string, MaterialEntry>();
  for (const e of entries) {
    const key = `${e.materialId}:${e.isSet ? "set" : "flat"}`;
    const prev = merged.get(key);
    merged.set(key, prev ? { ...prev, quantity: prev.quantity + e.quantity } : { ...e });
  }
  const sorted = [...merged.values()]
    .filter((e) => e.quantity > 0)
    .sort(
      (a, b) =>
        (a.category ?? "Overig").localeCompare(b.category ?? "Overig", "nl") ||
        a.name.localeCompare(b.name, "nl"),
    );
  const lines = sorted.map((e) => `${e.quantity}x ${e.name}${e.isSet ? " (set)" : ""}`);
  if (lines.length <= MAX_MATERIAL_LINES) return lines;
  return [...lines.slice(0, MAX_MATERIAL_LINES), `… en ${lines.length - MAX_MATERIAL_LINES} meer`];
}

const MATERIAL_SELECT = {
  id: true,
  name: true,
  category: true,
  categoryRel: { select: { name: true } },
} as const;

type MaterialRow = { id: number; name: string; category: string | null; categoryRel: { name: string } | null };

function toEntry(m: MaterialRow, quantity: number, isSet: boolean): MaterialEntry {
  return { materialId: m.id, name: m.name, category: m.categoryRel?.name ?? m.category, quantity, isSet };
}

/** periodId → material lines, for the given periods. Component units of a
 * set (stock items or shortages with a `bundleBookingId`) are skipped. One
 * query per booking kind, however many periods. */
export async function loadPeriodMaterialLines(
  client: PrismaClient,
  periodIds: number[],
): Promise<Map<number, string[]>> {
  if (periodIds.length === 0) return new Map();
  const [stock, bundles, shortages] = await Promise.all([
    client.periodStockItem.findMany({
      where: { periodId: { in: periodIds }, bundleBookingId: null },
      select: { periodId: true, stockItem: { select: { material: { select: MATERIAL_SELECT } } } },
    }),
    client.periodBundleBooking.findMany({
      where: { periodId: { in: periodIds } },
      select: { periodId: true, quantity: true, material: { select: MATERIAL_SELECT } },
    }),
    client.periodMaterialShortage.findMany({
      // Only hired-in shortages: those units will really be there. An open
      // shortage is "wanted but not in stock" — listing it would tell the crew
      // to expect material that may never arrive.
      where: { periodId: { in: periodIds }, bundleBookingId: null, supplierId: { not: null } },
      select: { periodId: true, quantity: true, material: { select: MATERIAL_SELECT } },
    }),
  ]);

  const byPeriod = new Map<number, MaterialEntry[]>();
  const push = (periodId: number, entry: MaterialEntry) => {
    const list = byPeriod.get(periodId) ?? [];
    list.push(entry);
    byPeriod.set(periodId, list);
  };
  for (const s of stock) push(s.periodId, toEntry(s.stockItem.material, 1, false));
  for (const b of bundles) push(b.periodId, toEntry(b.material, b.quantity, true));
  for (const s of shortages) push(s.periodId, toEntry(s.material, s.quantity, false));

  return new Map([...byPeriod].map(([id, entries]) => [id, summarizePeriodMaterials(entries)]));
}
