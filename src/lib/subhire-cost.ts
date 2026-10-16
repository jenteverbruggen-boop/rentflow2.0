import { toNumberOrNull } from "@/lib/serialize";
import type { SubhireCostBasis } from "@/types";

export interface SubhireCostInput {
  quantity: number;
  subhireCostBasis?: SubhireCostBasis | string | null;
  subhireUnitCost?: unknown;
  subhireCostOverride?: unknown;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * What the supplier charges for one hired-in row — computed when read, never
 * stored, so a period whose dates change can't leave a stale total behind.
 * An explicit `subhireCostOverride` (supplier discount, transport) wins;
 * otherwise `per_huur` is units × unit price once, `per_dag` is units × unit
 * price × the period's billed days (`periodDays()`, the same count the client
 * is billed for). `null` when no cost was entered at all.
 */
export function subhireTotal(row: SubhireCostInput, days: number): number | null {
  const override = toNumberOrNull(row.subhireCostOverride);
  if (override != null) return round2(override);
  const unit = toNumberOrNull(row.subhireUnitCost);
  if (unit == null) return null;
  const perDay = row.subhireCostBasis === "per_dag";
  return round2(unit * row.quantity * (perDay ? Math.max(days, 1) : 1));
}
