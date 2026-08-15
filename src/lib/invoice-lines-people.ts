import type { Period } from "@/types";
import { personLineCost } from "@/lib/pricing";
import { toNumber } from "@/lib/serialize";
import type { DraftInvoiceLine } from "@/lib/invoice-lines";

/** J2b.1 — extracted from invoice-lines.ts to stay under the 150-line
 * limit: the person + itemised-travel line generation for one period. */
export function personAndTravelLines(
  period: Period,
  days: number,
  vatRate: number,
  push: (line: Omit<DraftInvoiceLine, "sortOrder">) => void,
): void {
  for (const pp of period.people) {
    const hourly = pp.billingUnit === "uur" && pp.startAt && pp.endAt;
    const quantity = hourly
      ? (new Date(pp.endAt as string).getTime() - new Date(pp.startAt as string).getTime()) / 3_600_000
      : days;
    push({
      section: period.name, kind: "person", description: pp.person.name,
      quantity, unit: hourly ? "uur" : "dag",
      unitPrice: pp.rateSnapshot ?? pp.dayPriceSnapshot ?? 0,
      vatRate, lineTotalExcl: personLineCost(pp, days),
      sourceKind: "person", sourceId: pp.id,
    });
    for (const t of pp.travelCosts ?? []) {
      const label = t.label ? `: ${t.label}` : "";
      push({
        section: period.name, kind: "travel",
        description: `Reiskosten — ${pp.person.name}${label}`,
        quantity: t.quantity, unit: "stuk", unitPrice: toNumber(t.unitCost),
        vatRate, lineTotalExcl: toNumber(t.unitCost) * t.quantity,
        sourceKind: "travelCost", sourceId: t.id,
      });
    }
  }
}
