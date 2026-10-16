import { describe, it, expect } from "vitest";
import { structuredReference, isValidStructuredReference } from "@/lib/invoice-reference";

describe("structuredReference", () => {
  it("formats ten digits plus the mod-97 check as +++XXX/XXXX/XXXXX+++", () => {
    // 2026000001 mod 97 = 92 → check digits 92
    expect(structuredReference(2026, 1)).toBe("+++202/6000/00192+++");
  });

  it("writes a remainder of 0 as 97", () => {
    // 2026000000 + n is divisible by 97 for exactly one n in 1..97.
    const n = [...Array(97).keys()].map((i) => i + 1).find((i) => (2026000000 + i) % 97 === 0)!;
    const ref = structuredReference(2026, n);
    expect(ref.endsWith("97+++")).toBe(true);
    expect(isValidStructuredReference(ref)).toBe(true);
  });

  it("is always valid, for every sequence number tried", () => {
    for (let seq = 1; seq <= 500; seq++) expect(isValidStructuredReference(structuredReference(2026, seq))).toBe(true);
  });

  it("different invoices get different references", () => {
    expect(structuredReference(2026, 1)).not.toBe(structuredReference(2026, 2));
    expect(structuredReference(2026, 1)).not.toBe(structuredReference(2027, 1));
  });

  it("rejects out-of-range input", () => {
    expect(() => structuredReference(2026, 0)).toThrow();
    expect(() => structuredReference(2026, 1_000_000)).toThrow();
    expect(() => structuredReference(26, 1)).toThrow();
  });

  it("validation catches a wrong check digit or a malformed string", () => {
    expect(isValidStructuredReference("+++202/6000/00193+++")).toBe(false);
    expect(isValidStructuredReference("202/6000/00192")).toBe(false);
  });
});
