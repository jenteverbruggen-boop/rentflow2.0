import { describe, expect, it } from "vitest";
import { toNumber, toNumberOrNull } from "./serialize";

class FakeDecimal {
  constructor(private value: string) {}
  toString() {
    return this.value;
  }
}
Object.defineProperty(FakeDecimal, "name", { value: "Decimal" });

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
