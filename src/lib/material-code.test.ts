import { describe, it, expect } from "vitest";
import { nextCode } from "@/lib/material-code";

describe("nextCode", () => {
  it("first code with no existing = -001", () => {
    expect(nextCode("04", [])).toBe("0401-001");
  });

  it("next sequential", () => {
    expect(nextCode("04", ["0401-001", "0401-002"])).toBe("0401-003");
  });

  it("fills gaps", () => {
    expect(nextCode("04", ["0401-001", "0401-003"])).toBe("0401-002");
  });

  it("ignores malformed codes", () => {
    expect(nextCode("04", ["0401-001", "bad-code", "898-xxx"])).toBe("0401-002");
  });

  it("ignores codes from other prefixes", () => {
    expect(nextCode("03", ["0401-001", "0401-002"])).toBe("0301-001");
  });

  it("throws when no code available", () => {
    const full = Array.from({ length: 999 }, (_, i) => `0401-${String(i + 1).padStart(3, "0")}`);
    expect(() => nextCode("04", full)).toThrow("Geen vrije code meer in deze categorie");
  });
});
