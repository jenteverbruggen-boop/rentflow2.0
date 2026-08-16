import { describe, it, expect } from "vitest";
import { computeInvoiceTotals } from "@/lib/invoice-totals";

describe("computeInvoiceTotals (J2b.2)", () => {
  it("reproduces the deposit invoice's totals from the worked example (design doc §4.1)", () => {
    const totals = computeInvoiceTotals([
      { kind: "deposit", lineTotalExcl: 1110, vatRate: 21 },
    ]);
    expect(totals).toEqual({ subtotalExcl: 1110, travelExcl: 0, deductionExcl: 0, vatAmount: 233.1, totalIncl: 1343.1 });
  });

  it("reproduces the final invoice's totals, including the deduction line (§4.2)", () => {
    const totals = computeInvoiceTotals([
      { kind: "person", lineTotalExcl: 400, vatRate: 21 },
      { kind: "material", lineTotalExcl: 800, vatRate: 21 },
      { kind: "travel", lineTotalExcl: 50, vatRate: 21 },
      { kind: "person", lineTotalExcl: 1600, vatRate: 21 },
      { kind: "bundle", lineTotalExcl: 700, vatRate: 21 },
      { kind: "travel", lineTotalExcl: 150, vatRate: 21 },
      { kind: "deduction", lineTotalExcl: -1110, vatRate: 21 },
    ]);
    expect(totals).toEqual({
      subtotalExcl: 3500, travelExcl: 200, deductionExcl: -1110, vatAmount: 543.9, totalIncl: 3133.9,
    });
  });

  it("travel lines never enter subtotalExcl even when they're the only line", () => {
    const totals = computeInvoiceTotals([{ kind: "travel", lineTotalExcl: 50, vatRate: 21 }]);
    expect(totals.subtotalExcl).toBe(0);
    expect(totals.travelExcl).toBe(50);
  });
});
