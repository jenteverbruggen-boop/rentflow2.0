import { toNumber } from "@/lib/serialize";

/** One row per component per bundle booking (PeriodBundleBookingComponent):
 * the only place a set's per-component weight is recorded. */
export interface ComponentWeight {
  bundleBookingId: number;
  materialId: number;
  quantity: number;
  dayPriceAtBooking: number | null;
}

interface BookingLine {
  id: number;
  quantity: number;
  dayPriceSnapshot: number | null;
}

/**
 * A component's revenue share of a whole set line (price × quantity × days),
 * split pro-rata by the weights snapshotted at booking time — never the live
 * Material.dayPrice, which would silently rewrite history. All-weights-zero
 * falls back to an equal split. 0 when the component isn't part of the booking.
 */
export function componentShare(
  booking: BookingLine,
  weights: ComponentWeight[],
  materialId: number,
  days: number,
): number {
  const mine = weights.filter((w) => w.bundleBookingId === booking.id);
  const thisWeight = mine.find((w) => w.materialId === materialId);
  if (!thisWeight) return 0;
  const weightOf = (w: ComponentWeight) => toNumber(w.dayPriceAtBooking) * w.quantity;
  const totalWeight = mine.reduce((s, w) => s + weightOf(w), 0);
  const lineTotal = toNumber(booking.dayPriceSnapshot) * booking.quantity * days;
  return totalWeight === 0 ? lineTotal / mine.length : lineTotal * (weightOf(thisWeight) / totalWeight);
}

/** Units of a component the whole booking needs. */
export function unitsNeeded(booking: BookingLine, weights: ComponentWeight[], materialId: number): number {
  const w = weights.find((x) => x.bundleBookingId === booking.id && x.materialId === materialId);
  return w ? w.quantity * booking.quantity : 0;
}

/** The part of a component's share that belongs to `units` of its needed
 * units (hired or open units take their pro-rata part away from owned stock). */
export function shareOfUnits(
  booking: BookingLine,
  weights: ComponentWeight[],
  materialId: number,
  days: number,
  units: number,
): number {
  const needed = unitsNeeded(booking, weights, materialId);
  if (needed <= 0) return 0;
  return componentShare(booking, weights, materialId, days) * Math.min(1, Math.max(0, units / needed));
}

/** Units of a component that are *not* backed by owned stock in a booking:
 * hired-in and open rows alike. */
export function missingUnits(
  shortages: { bundleBookingId: number | null; materialId: number; quantity: number }[],
  bookingId: number,
  materialId: number,
): number {
  return shortages
    .filter((s) => s.bundleBookingId === bookingId && s.materialId === materialId)
    .reduce((sum, s) => sum + s.quantity, 0);
}
