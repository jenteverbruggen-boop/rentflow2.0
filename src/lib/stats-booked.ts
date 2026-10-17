import { periodPeopleCost, periodMaterialsCost, periodTravelCost } from "@/lib/pricing";
import { monthWeights } from "@/lib/stats-months";
import { addToSplit, bucketOf, emptySplit, roundSplit, type BucketedPeriod, type Split } from "@/lib/stats-status";

export interface BookedMonthEntry {
  month: string;
  bookedPeople: Split;
  bookedMaterials: Split;
  bookedTravel: Split;
  booked: Split;
}

/**
 * K1.1 — booked revenue is attributed to the *period* (never the
 * invoice), pro-rata split by calendar days across any month boundary
 * it crosses (design doc's own decided rule, stats-months.ts). Every figure
 * is split into agreed (bevestigd/actief/afgerond) and still-to-confirm
 * (concept) by the period's project status (D1). Never calls
 * BTW_RATE/btwAmount/withBtw — those are a flat-rate constant unrelated to
 * invoices' per-line VAT, and this is all excl-VAT booked/invoiced
 * comparison in the first place.
 */
export function aggregateBookedByMonth(periods: BucketedPeriod[]): Map<string, BookedMonthEntry> {
  const byMonth = new Map<string, BookedMonthEntry>();
  for (const period of periods) {
    const bucket = bucketOf(period);
    const people = periodPeopleCost(period);
    const materials = periodMaterialsCost(period);
    const travel = periodTravelCost(period);
    const weights = monthWeights(new Date(period.startDate), new Date(period.endDate));

    for (const [month, weight] of weights) {
      const entry = byMonth.get(month) ?? {
        month, bookedPeople: emptySplit(), bookedMaterials: emptySplit(), bookedTravel: emptySplit(), booked: emptySplit(),
      };
      addToSplit(entry.bookedPeople, bucket, people * weight);
      addToSplit(entry.bookedMaterials, bucket, materials * weight);
      addToSplit(entry.bookedTravel, bucket, travel * weight);
      addToSplit(entry.booked, bucket, (people + materials + travel) * weight);
      byMonth.set(month, entry);
    }
  }
  for (const entry of byMonth.values()) {
    entry.bookedPeople = roundSplit(entry.bookedPeople);
    entry.bookedMaterials = roundSplit(entry.bookedMaterials);
    entry.bookedTravel = roundSplit(entry.bookedTravel);
    entry.booked = roundSplit(entry.booked);
  }
  return byMonth;
}
