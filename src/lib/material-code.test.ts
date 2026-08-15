import { describe, it, expect } from "vitest";
import { nextCode } from "@/lib/material-code";

// M1 — rewritten for the 4-digit prefix pattern (^${prefix}-(\d{3})$).
// Every call now passes a full 4-digit prefix directly, not a 2-digit
// one with the old hard-coded "01" segment.
describe("nextCode", () => {
  it("first code with no existing = -001", () => {
    expect(nextCode("0401", [])).toBe("0401-001");
  });

  it("next sequential", () => {
    expect(nextCode("0401", ["0401-001", "0401-002"])).toBe("0401-003");
  });

  it("fills gaps", () => {
    expect(nextCode("0401", ["0401-001", "0401-003"])).toBe("0401-002");
  });

  it("ignores malformed codes", () => {
    expect(nextCode("0401", ["0401-001", "bad-code", "898-xxx"])).toBe(
      "0401-002",
    );
  });

  it("ignores codes from other prefixes", () => {
    expect(nextCode("0301", ["0401-001", "0401-002"])).toBe("0301-001");
  });

  it("throws when no code available", () => {
    const full = Array.from(
      { length: 999 },
      (_, i) => `0401-${String(i + 1).padStart(3, "0")}`,
    );
    expect(() => nextCode("0401", full)).toThrow(
      "Geen vrije code meer in deze categorie",
    );
  });

  // The regression the design doc calls for: a real 4-digit prefix that
  // would have collided under the old 2-digit-truncating pattern
  // (0501 and 9998 both start "05"/"99" respectively, but the fix is
  // specifically about *not* truncating to those 2 characters).
  it("a real 4-digit folder prefix produces the exact shape seen in the equipment export", () => {
    expect(nextCode("0501", ["0501-001", "0501-002"])).toBe("0501-003");
  });
});
