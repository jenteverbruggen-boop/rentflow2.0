import { describe, it, expect } from "vitest";
import { assertLinePatchAllowed, newLineData, roundMoney, InvoiceLineEditError } from "@/lib/invoice-line-rules";

const cur = (kind: string) => ({ kind, quantity: 2, unit: "dag", unitPrice: 100, vatRate: 21 });

describe("assertLinePatchAllowed (C8)", () => {
  it("lets any line change its description, quantity and price", () => {
    expect(() => assertLinePatchAllowed(cur("person"), { description: "x", quantity: 3, unitPrice: 90 })).not.toThrow();
  });

  it("only a manual line may change VAT or unit", () => {
    expect(() => assertLinePatchAllowed(cur("manual"), { vatRate: 6, unit: "uur" })).not.toThrow();
    for (const kind of ["person", "material", "bundle", "travel", "deposit", "deduction"]) {
      expect(() => assertLinePatchAllowed(cur(kind), { vatRate: 6 })).toThrow(InvoiceLineEditError);
      expect(() => assertLinePatchAllowed(cur(kind), { unit: "uur" })).toThrow(InvoiceLineEditError);
    }
  });

  it("an echoed, unchanged value is not an edit", () => {
    expect(() => assertLinePatchAllowed(cur("person"), { vatRate: 21, unit: "dag", quantity: 2 })).not.toThrow();
  });

  it("a text line takes no amounts, and a deduction no quantity or price", () => {
    expect(() => assertLinePatchAllowed(cur("text"), { description: "nieuwe tekst" })).not.toThrow();
    expect(() => assertLinePatchAllowed(cur("text"), { unitPrice: 5 })).toThrow(InvoiceLineEditError);
    expect(() => assertLinePatchAllowed(cur("text"), { quantity: 1 })).toThrow(InvoiceLineEditError);
    expect(() => assertLinePatchAllowed(cur("deduction"), { unitPrice: 5 })).toThrow(InvoiceLineEditError);
    expect(() => assertLinePatchAllowed(cur("deduction"), { description: "x" })).not.toThrow();
  });
});

describe("newLineData", () => {
  it("builds a zeroed text line", () => {
    expect(newLineData("text", { description: "Afspraak", section: "Opbouw" }, 21)).toMatchObject({
      kind: "text", quantity: 0, unitPrice: 0, vatRate: 0, lineTotalExcl: 0, section: "Opbouw",
    });
  });

  it("rounds a manual line's price and total to cents and defaults VAT", () => {
    const line = newLineData("manual", { description: "Kost", quantity: 3, unit: "stuk", unitPrice: 10.005 }, 21);
    expect(line.unitPrice).toBe(roundMoney(10.005));
    expect(line.lineTotalExcl).toBe(roundMoney(3 * roundMoney(10.005)));
    expect(line.vatRate).toBe(21);
  });

  it("keeps a negative price (discount) and an explicit VAT rate", () => {
    expect(newLineData("manual", { description: "Korting", quantity: 1, unit: "stuk", unitPrice: -50, vatRate: 6 }, 21))
      .toMatchObject({ unitPrice: -50, lineTotalExcl: -50, vatRate: 6 });
  });
});
