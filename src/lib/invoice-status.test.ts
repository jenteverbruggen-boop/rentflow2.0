import { describe, it, expect } from "vitest";
import { netInvoicedExcl, resolveInvoiceDisplayStatus, remainingBalance, effectiveOwed } from "@/lib/invoice-status";

describe("netInvoicedExcl (J2b.2, design doc §5)", () => {
  it("an invoice with no credit notes returns its own net figure", () => {
    expect(netInvoicedExcl({ subtotalExcl: 1110, travelExcl: 0, deductionExcl: 0 })).toBe(1110);
  });

  it("a non-concept credit note nets against the original (§4.3's −€300 example)", () => {
    const final = {
      subtotalExcl: 3500, travelExcl: 200, deductionExcl: -1110,
      creditNotes: [{ status: "verzonden", subtotalExcl: -300, travelExcl: 0, deductionExcl: 0 }],
    };
    // 3500 + 200 - 1110 - 300 = 2290
    expect(netInvoicedExcl(final)).toBe(2290);
  });

  it("a draft (concept) credit note has no effect yet", () => {
    const invoice = {
      subtotalExcl: 1000, travelExcl: 0, deductionExcl: 0,
      creditNotes: [{ status: "concept", subtotalExcl: -100, travelExcl: 0, deductionExcl: 0 }],
    };
    expect(netInvoicedExcl(invoice)).toBe(1000);
  });
});

const NOW = new Date("2026-08-15T12:00:00Z");

describe("resolveInvoiceDisplayStatus (J2b.6, design doc §6.2 priority table)", () => {
  it("priority 1: a credit note always displays as creditnota, regardless of status", () => {
    expect(resolveInvoiceDisplayStatus({ kind: "creditnota", status: "verzonden", totalIncl: -100, dueDate: null }, NOW))
      .toBe("creditnota");
  });

  it("priority 2: concept", () => {
    expect(resolveInvoiceDisplayStatus({ kind: "invoice", status: "concept", totalIncl: 100, dueDate: null }, NOW))
      .toBe("concept");
  });

  it("priority 3: betaald, even past its due date", () => {
    expect(resolveInvoiceDisplayStatus(
      { kind: "invoice", status: "betaald", totalIncl: 100, dueDate: "2020-01-01" }, NOW,
    )).toBe("betaald");
  });

  it("priority 4: verzonden + overdue + balance remaining = vervallen (wins over gedeeltelijk_betaald)", () => {
    expect(resolveInvoiceDisplayStatus(
      { kind: "invoice", status: "verzonden", totalIncl: 100, dueDate: "2020-01-01", payments: [{ amount: 40 }] }, NOW,
    )).toBe("vervallen");
  });

  it("priority 5: verzonden + not overdue + some but not all paid = gedeeltelijk_betaald", () => {
    expect(resolveInvoiceDisplayStatus(
      { kind: "invoice", status: "verzonden", totalIncl: 100, dueDate: "2030-01-01", payments: [{ amount: 40 }] }, NOW,
    )).toBe("gedeeltelijk_betaald");
  });

  it("priority 6: verzonden, not overdue, unpaid — the plain default", () => {
    expect(resolveInvoiceDisplayStatus(
      { kind: "invoice", status: "verzonden", totalIncl: 100, dueDate: "2030-01-01" }, NOW,
    )).toBe("verzonden");
  });
});

describe("remainingBalance / effectiveOwed (J2b.6, design doc §6.1)", () => {
  it("nets a non-concept credit note's totalIncl against the original", () => {
    const invoice = {
      kind: "invoice", status: "verzonden", totalIncl: 1343.1, dueDate: null,
      creditNotes: [{ status: "verzonden", totalIncl: -363 }],
    };
    expect(effectiveOwed(invoice)).toBe(980.1);
  });

  it("overpayment surfaces as a negative balance, never clamped to 0", () => {
    const invoice = {
      kind: "invoice", status: "betaald", totalIncl: 100, dueDate: null,
      payments: [{ amount: 150 }],
    };
    expect(remainingBalance(invoice)).toBe(-50);
  });
});
