import { describe, it, expect } from "vitest";
import { netInvoicedExcl } from "@/lib/invoice-status";

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
