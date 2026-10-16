import { toNumber, toNumberOrNull } from "@/lib/serialize";

type Money = Parameters<typeof toNumber>[0];

/**
 * The day price of a set (bundle): its own override when one is set, else the
 * sum of its components' day prices × the quantity needed per set. This is
 * the one formula — the materials list, the picker and the booking route
 * (which snapshots it onto the booking) must all use it, or the price shown
 * and the price charged drift apart. Archived components still count, as they
 * do when a set is booked.
 */
export function setDayPrice(
  bundlePriceOverride: Money | null | undefined,
  components: { quantity: number; child: { dayPrice: Money } }[],
): number {
  const override = toNumberOrNull(bundlePriceOverride);
  if (override != null) return override;
  return components.reduce((sum, c) => sum + toNumber(c.child.dayPrice) * c.quantity, 0);
}
