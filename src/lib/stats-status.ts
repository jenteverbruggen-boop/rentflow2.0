import type { Period } from "@/types";

/** Cijfers shows two buckets of booked figures: what is agreed with the
 * client, and what is still to be confirmed. Cancelled projects are left out. */
export type StatsBucket = "afgesproken" | "teBevestigen";

export function statusBucket(status: string): StatsBucket | null {
  if (status === "bevestigd" || status === "actief" || status === "afgerond") return "afgesproken";
  if (status === "concept") return "teBevestigen";
  return null; // geannuleerd (and anything unknown) is not counted
}

/** A period tagged with its project's bucket. An untagged period counts as
 * agreed (hand-built fixtures, callers that don't care about the split). */
export type BucketedPeriod = Period & { bucket?: StatsBucket };

export const bucketOf = (p: BucketedPeriod): StatsBucket => p.bucket ?? "afgesproken";

/** A figure in both buckets. */
export interface Split {
  agreed: number;
  pending: number;
}

export const emptySplit = (): Split => ({ agreed: 0, pending: 0 });

export function addToSplit(split: Split, bucket: StatsBucket, amount: number): void {
  if (bucket === "afgesproken") split.agreed += amount;
  else split.pending += amount;
}

const round = (n: number) => Math.round(n * 100) / 100;
export const roundSplit = (s: Split): Split => ({ agreed: round(s.agreed), pending: round(s.pending) });
export const splitTotal = (s: Split) => round(s.agreed + s.pending);
