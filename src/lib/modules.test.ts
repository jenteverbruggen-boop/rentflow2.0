import { describe, it, expect } from "vitest";
import { MODULES, satisfies } from "./modules";
import type { AccessLevel } from "@/types";

const LEVELS: AccessLevel[] = ["geen", "lezen", "wijzigen", "verwijderen"];

describe("MODULES", () => {
  it("has exactly ten entries", () => {
    expect(MODULES).toHaveLength(10);
  });

  it("uses the exact Dutch labels from the decided design", () => {
    const labels = MODULES.map((m) => m.label);
    expect(labels).toEqual([
      "Projecten",
      "Planning",
      "Personen",
      "Materialen",
      "Klanten",
      "Locaties",
      "Kosten/Facturen",
      "Cijfers",
      "Gebruikers",
      "Instellingen",
    ]);
  });
});

describe("satisfies (all 16 level-pair combinations)", () => {
  const expected: Record<string, boolean> = {
    "geen|geen": true,
    "geen|lezen": false,
    "geen|wijzigen": false,
    "geen|verwijderen": false,
    "lezen|geen": true,
    "lezen|lezen": true,
    "lezen|wijzigen": false,
    "lezen|verwijderen": false,
    "wijzigen|geen": true,
    "wijzigen|lezen": true,
    "wijzigen|wijzigen": true,
    "wijzigen|verwijderen": false,
    "verwijderen|geen": true,
    "verwijderen|lezen": true,
    "verwijderen|wijzigen": true,
    "verwijderen|verwijderen": true,
  };

  for (const held of LEVELS) {
    for (const required of LEVELS) {
      const key = `${held}|${required}`;
      it(`held=${held}, required=${required} -> ${expected[key]}`, () => {
        expect(satisfies(held, required)).toBe(expected[key]);
      });
    }
  }

  it("never throws, including the geen/geen degenerate case", () => {
    expect(() => satisfies("geen", "geen")).not.toThrow();
  });
});
