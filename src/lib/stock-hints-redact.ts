import type { StockHint } from "@/types";

/** Scope-own callers never learn another project's name or id: only that a
 * unit is held, and in which status. */
export function redactStockHints(hints: StockHint[], scope: "all" | "own"): StockHint[] {
  if (scope !== "own") return hints;
  return hints.map((h) =>
    h.kind === "open"
      ? { ...h, holders: h.holders.map(({ units, status }) => ({ units, status })) }
      : h,
  );
}
