import { periodPeopleCost, periodMaterialsCost, periodTravelCost } from "@/lib/pricing";
import { monthWeights } from "@/lib/stats-months";
import type { Period } from "@/types";

export interface BookedMonthEntry {
  month: string;
  bookedPeople: number;
  bookedMaterials: number;
  bookedTravel: number;
  booked: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * K1.1 — booked revenue is attributed to the *period* (never the
 * invoice), pro-rata split by calendar days across any month boundary
 * it crosses (design doc's own decided rule, stats-months.ts). Never
 * calls BTW_RATE/btwAmount/withBtw — those are a flat-rate constant
 * unrelated to invoices' per-line VAT, and this is all excl-VAT
 * booked/invoiced comparison in the first place.
 */
export function aggregateBookedByMonth(periods: Period[]): Map<string, BookedMonthEntry> {
  const byMonth = new Map<string, BookedMonthEntry>();
  for (const period of periods) {
    const people = periodPeopleCost(period);
    const materials = periodMaterialsCost(period);
    const travel = periodTravelCost(period);
    const weights = monthWeights(new Date(period.startDate), new Date(period.endDate));

    for (const [month, weight] of weights) {
      const entry = byMonth.get(month) ?? {
        month, bookedPeople: 0, bookedMaterials: 0, bookedTravel: 0, booked: 0,
      };
      entry.bookedPeople += people * weight;
      entry.bookedMaterials += materials * weight;
      entry.bookedTravel += travel * weight;
      entry.booked += (people + materials + travel) * weight;
      byMonth.set(month, entry);
    }
  }
  for (const entry of byMonth.values()) {
    entry.bookedPeople = round(entry.bookedPeople);
    entry.bookedMaterials = round(entry.bookedMaterials);
    entry.bookedTravel = round(entry.bookedTravel);
    entry.booked = round(entry.booked);
  }
  return byMonth;
}
