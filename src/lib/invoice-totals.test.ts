import { describe, it, expect } from "vitest";
import { computeInvoiceTotals, vatByRate } from "@/lib/invoice-totals";

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

describe("free-text and mixed-VAT lines (C8)", () => {
  it("a text line contributes nothing to any total or VAT row", () => {
    const withText = computeInvoiceTotals([
      { kind: "person", lineTotalExcl: 100, vatRate: 21 },
      { kind: "text", lineTotalExcl: 0, vatRate: 0 },
    ]);
    expect(withText).toEqual(computeInvoiceTotals([{ kind: "person", lineTotalExcl: 100, vatRate: 21 }]));
    expect([...vatByRate([{ kind: "text", lineTotalExcl: 0, vatRate: 0 }]).keys()]).toEqual([]);
  });

  it("a negative manual line (discount) lowers the subtotal and its VAT", () => {
    const totals = computeInvoiceTotals([
      { kind: "person", lineTotalExcl: 200, vatRate: 21 },
      { kind: "manual", lineTotalExcl: -50, vatRate: 21 },
    ]);
    expect(totals).toMatchObject({ subtotalExcl: 150, vatAmount: 31.5, totalIncl: 181.5 });
  });

  it("vatAmount is the sum of the per-rate rows, so the printed rows always add up", () => {
    // 0.5% of each rounds the wrong way when summed first: 3 × (€0.10 @ 6%) is
    // 0.018 → 0.02 per rate row, but 0.018 + 0.0504 = 0.0684 → 0.07 overall.
    const lines = [
      { kind: "manual" as const, lineTotalExcl: 0.3, vatRate: 6 },
      { kind: "manual" as const, lineTotalExcl: 0.24, vatRate: 21 },
    ];
    const rows = vatByRate(lines);
    const sumOfRows = Math.round([...rows.values()].reduce((a, b) => a + b, 0) * 100) / 100;
    expect(computeInvoiceTotals(lines).vatAmount).toBe(sumOfRows);
  });
});
