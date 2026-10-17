import { describe, it, expect } from "vitest";
import { redactStockHints } from "@/lib/stock-hints-redact";
import type { StockHint } from "@/types";

const hints: StockHint[] = [
  { shortageId: 1, kind: "open", freeNow: 0, more: 1, holders: [{ projectId: 9, name: "Geheim", status: "concept", units: 3 }] },
  { shortageId: 2, kind: "hired", ownFreeNow: 2 },
];

describe("redactStockHints", () => {
  it("keeps names for scope all", () => {
    expect(redactStockHints(hints, "all")).toEqual(hints);
  });
  it("drops project id and name for scope own, keeping counts", () => {
    const out = redactStockHints(hints, "own");
    expect(out[0]).toMatchObject({ holders: [{ units: 3, status: "concept" }], more: 1 });
    expect(JSON.stringify(out)).not.toMatch(/Geheim|projectId|"name"/);
    expect(out[1]).toEqual(hints[1]);
  });
});
