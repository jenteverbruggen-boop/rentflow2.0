import { describe, expect, it } from "vitest";
import { toNumber, toNumberOrNull } from "./serialize";

/**
 * Mirrors decimal.js's actual instance shape (sign/exponent/digits +
 * `toFixed`), not just its printable class name — deliberately named
 * something other than "Decimal" and never given a `name` override.
 * A real production bundle renames the genuine class to avoid a scope
 * collision (`Decimal` -> `Decimal2`; reproduced against the actual
 * generated client in prod, see serialize.ts's isDecimalish comment),
 * so a fake whose `.name` happens to read "Decimal" would let a
 * regression back to a name-string check slip past this suite
 * unnoticed — which is exactly what happened before this fix.
 */
class FakeDecimal {
  s = 1;
  e = 0;
  d: number[];
  constructor(private value: string) {
    this.d = value.split("").map(Number);
  }
  toString() {
    return this.value;
  }
  toFixed() {
    return this.value;
  }
}

describe("toNumber", () => {
  it("passes plain numbers through", () => {
    expect(toNumber(150)).toBe(150);
    expect(toNumber(0)).toBe(0);
    expect(toNumber(12.5)).toBe(12.5);
  });

  it("converts numeric strings", () => {
    expect(toNumber("150")).toBe(150);
    expect(toNumber("12.50")).toBe(12.5);
  });

  it("converts the numeric string \"0\" to 0, not NaN", () => {
    expect(toNumber("0")).toBe(0);
  });

  it("converts Decimal-like objects", () => {
    expect(toNumber(new FakeDecimal("150"))).toBe(150);
    expect(toNumber(new FakeDecimal("12.50"))).toBe(12.5);
  });

  it("converts null and undefined to 0", () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });

  it("throws on non-numeric input rather than returning NaN", () => {
    expect(() => toNumber("not a number")).toThrow();
    expect(() => toNumber({})).toThrow();
    expect(() => toNumber(NaN)).toThrow();
    expect(() => toNumber(Infinity)).toThrow();
  });
});

describe("toNumberOrNull", () => {
  it("preserves null", () => {
    expect(toNumberOrNull(null)).toBeNull();
  });

  it("preserves undefined", () => {
    expect(toNumberOrNull(undefined)).toBeUndefined();
  });

  it("converts present values", () => {
    expect(toNumberOrNull("10")).toBe(10);
    expect(toNumberOrNull(new FakeDecimal("5"))).toBe(5);
  });
});
