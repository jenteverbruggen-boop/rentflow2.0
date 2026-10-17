import type { StockHint, StockHolder } from "@/types";

/** How many of an open line can be assigned from own stock right now. */
export function freeForLine(hint: StockHint | undefined, quantity: number): number {
  return hint?.kind === "open" ? Math.min(hint.freeNow, quantity) : 0;
}

/** True when any holder is anonymous (scope own): show the generic hint. */
export const anonymousHolders = (holders: StockHolder[]) => holders.some((h) => h.name == null);
