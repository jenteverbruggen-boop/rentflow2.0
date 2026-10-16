import { describe, it, expect } from "vitest";
import { setDayPrice } from "@/lib/set-price";

const parts = [
  { quantity: 2, child: { dayPrice: 10 } },
  { quantity: 1, child: { dayPrice: 5.5 } },
];

describe("setDayPrice", () => {
  it("sums component price × quantity when there is no override", () => {
    expect(setDayPrice(null, parts)).toBe(25.5);
    expect(setDayPrice(undefined, parts)).toBe(25.5);
  });
  it("uses the override, even when it is 0", () => {
    expect(setDayPrice(99, parts)).toBe(99);
    expect(setDayPrice(0, parts)).toBe(0);
  });
  it("accepts Postgres-style Decimal values (they serialize as strings)", () => {
    expect(setDayPrice("12.5", [{ quantity: 2, child: { dayPrice: "3.25" } }])).toBe(12.5);
  });
  it("an empty set costs nothing", () => {
    expect(setDayPrice(null, [])).toBe(0);
  });
});
