import type { PeriodPerson } from "@/types";

/**
 * Bug fix: `LinePricePopover`'s drift indicator compares a booking's
 * frozen `dayPriceSnapshot` against the *current* price it would get if
 * resnapshotted today, to warn "this line is stale". For a person
 * booked via a function (L1/L2), the popover was passed
 * `pp.person.dayPrice` — the person's own bare rate — as that "current
 * price" reference, skipping the function-rate cascade level entirely
 * (`effective-price.ts`'s real order: project override → client rate
 * card → person-function rate → function default → person.dayPrice).
 * Any person actually booked at a function rate different from their
 * own base `dayPrice` therefore showed a permanent, un-clearable drift
 * warning — clicking "resnapshot" fixed the real price server-side (via
 * the true cascade) but the client-side comparison target never
 * matched it, so the warning never went away.
 *
 * This resolves the same cascade as far as it can go client-side
 * without a network round-trip: person-function override rate →
 * function default rate → person's own `dayPrice`. It intentionally
 * cannot see a `ClientFunctionRate` (that cascade level requires the
 * project's client and its rate card, neither embedded in this payload)
 * — a person whose *only* rate source is a client-specific rate card
 * can still show a false drift warning. Documented rather than silently
 * left, same as this project's other stated scope limits.
 */
export function resolvePersonBasePrice(pp: PeriodPerson): number {
  if (pp.functionId != null) {
    const personFunctionRate = pp.person.functions?.find(
      (f) => f.functionId === pp.functionId,
    )?.dayRate;
    if (personFunctionRate != null) return personFunctionRate;
    if (pp.function?.dayRate != null) return pp.function.dayRate;
  }
  return pp.person.dayPrice ?? 0;
}
