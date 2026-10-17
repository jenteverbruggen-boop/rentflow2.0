import { shareOfUnits } from "@/lib/bundle-share";
import { shortageCost } from "@/lib/material-shortage";
import type { Period, PeriodMaterialShortage } from "@/types";

/**
 * What the client pays for a hired-in row. A flat row bills like any other
 * unit. A hired *component of a set* has no price of its own: it gets its
 * pro-rata share of the set line (the weights snapshotted at booking), for
 * the hired units out of the units the booking needs of that component.
 */
export function hiredRowRevenue(
  period: Pick<Period, "bundleBookings" | "shortages">,
  row: PeriodMaterialShortage,
  days: number,
): number {
  if (row.bundleBookingId == null) return shortageCost([row], days);
  const booking = (period.bundleBookings ?? []).find((b) => b.id === row.bundleBookingId);
  if (!booking) return 0;
  return shareOfUnits(booking, booking.components ?? [], row.materialId, days, row.quantity);
}
