import { describe, it, expect } from "vitest";
import { aggregateInvoicedByMonth, aggregateInvoicedByClient, type StatsInvoice } from "@/lib/stats-invoiced";

function invoice(overrides: Partial<StatsInvoice> = {}): StatsInvoice {
  return {
    id: 1, kind: "invoice", status: "verzonden", clientId: 1,
    invoiceDate: "2026-06-15",
    subtotalExcl: 1000, travelExcl: 0, deductionExcl: 0,
    creditNotes: [],
    ...overrides,
  };
}

describe("aggregateInvoicedByMonth (K1.1 — bucketed by invoiceDate, never the period)", () => {
  it("sums an invoice into its own invoiceDate month", () => {
    const byMonth = aggregateInvoicedByMonth([invoice()]);
    expect(byMonth.get("2026-06")).toBe(1000);
  });

  it("excludes still-concept invoices (no invoiceDate yet, never sent)", () => {
    const byMonth = aggregateInvoicedByMonth([invoice({ status: "concept" })]);
    expect(byMonth.size).toBe(0);
  });

  it("excludes credit notes from direct iteration — their effect already folds into the original via netInvoicedExcl", () => {
    const original = invoice({
      id: 1, subtotalExcl: 1000,
      creditNotes: [{ status: "verzonden", subtotalExcl: -300, travelExcl: 0, deductionExcl: 0 }],
    });
    const byMonth = aggregateInvoicedByMonth([original]);
    // 1000 - 300 = 700, attributed to the original's own month, not the
    // credit note's (a credit note is never itself in this array).
    expect(byMonth.get("2026-06")).toBe(700);
  });

  it("multiple invoices in the same month accumulate", () => {
    const byMonth = aggregateInvoicedByMonth([
      invoice({ id: 1, subtotalExcl: 500 }),
      invoice({ id: 2, subtotalExcl: 300 }),
    ]);
    expect(byMonth.get("2026-06")).toBe(800);
  });
});

describe("aggregateInvoicedByClient (K1.1)", () => {
  it("sums per client, netting in credit notes", () => {
    const byClient = aggregateInvoicedByClient([
      invoice({ clientId: 1, subtotalExcl: 1000 }),
      invoice({ id: 2, clientId: 2, subtotalExcl: 500 }),
    ]);
    expect(byClient.get(1)).toBe(1000);
    expect(byClient.get(2)).toBe(500);
  });
});
