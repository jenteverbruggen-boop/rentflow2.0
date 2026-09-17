import { describe, it, expect } from "vitest";
import { normalizeVat, normalizeEmail, normalizeName } from "@/lib/import/client-normalize";

describe("normalizeVat (B4, round 3 PO feedback)", () => {
  it("strips dots, spaces and hyphens and upper-cases", () => {
    expect(normalizeVat("BE 0123.456.789")).toBe("BE0123456789");
    expect(normalizeVat("be0123456789")).toBe("BE0123456789");
    expect(normalizeVat("BE-0123-456-789")).toBe("BE0123456789");
  });

  it("returns null for null/undefined/blank input", () => {
    expect(normalizeVat(null)).toBeNull();
    expect(normalizeVat(undefined)).toBeNull();
    expect(normalizeVat("")).toBeNull();
    expect(normalizeVat("   ")).toBeNull();
  });
});

describe("normalizeEmail (B4, round 3 PO feedback)", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail("  Info@Acme.BE  ")).toBe("info@acme.be");
  });

  it("returns null for null/undefined/blank input", () => {
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
    expect(normalizeEmail("")).toBeNull();
  });
});

describe("normalizeName (B4, round 3 PO feedback)", () => {
  it("collapses internal whitespace runs and case-folds", () => {
    expect(normalizeName("Acme   BV")).toBe("acme bv");
    expect(normalizeName(" acme bv ")).toBe("acme bv");
    expect(normalizeName("ACME BV")).toBe("acme bv");
  });

  it("returns null for null/undefined/blank input", () => {
    expect(normalizeName(null)).toBeNull();
    expect(normalizeName(undefined)).toBeNull();
    expect(normalizeName("   ")).toBeNull();
  });
});
