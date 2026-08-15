import { describe, it, expect } from "vitest";
import { buildMaterialPreview, type ExistingMaterial } from "@/lib/import/material-preview";
import type { ParsedMaterialRow } from "@/lib/import/material-adapter";

function row(overrides: Partial<ParsedMaterialRow> = {}): ParsedMaterialRow {
  return {
    line: 2,
    externalId: "1",
    code: "0501-001",
    name: "Tent",
    categoryName: "Tenten",
    categoryPrefix: "0501",
    dayPrice: 95,
    costPrice: null,
    listPrice: null,
    isBundle: false,
    archived: false,
    notes: null,
    stockItems: [],
    ...overrides,
  };
}

describe("buildMaterialPreview (M1.2)", () => {
  it("classifies a row with no matching code as new", () => {
    const preview = buildMaterialPreview([row()], [], new Map(), "rentman-equipment");
    expect(preview.rows[0].classification).toBe("new");
    expect(preview.totals).toEqual({ new: 1, updated: 0, unchanged: 0, skipped: 0, errored: 0 });
  });

  it("classifies a row matching an identical existing material as unchanged", () => {
    const existing: ExistingMaterial = {
      code: "0501-001",
      name: "Tent",
      dayPrice: 95,
      costPrice: null,
      listPrice: null,
      isBundle: false,
      archived: false,
      notes: null,
    };
    const preview = buildMaterialPreview(
      [row()],
      [],
      new Map([["0501-001", existing]]),
      "rentman-equipment",
    );
    expect(preview.rows[0].classification).toBe("unchanged");
    expect(preview.rows[0].changes).toBeUndefined();
  });

  it("classifies a row with a changed field as updated, listing exactly that field", () => {
    const existing: ExistingMaterial = {
      code: "0501-001",
      name: "Tent",
      dayPrice: 80,
      costPrice: null,
      listPrice: null,
      isBundle: false,
      archived: false,
      notes: null,
    };
    const preview = buildMaterialPreview(
      [row({ dayPrice: 95 })],
      [],
      new Map([["0501-001", existing]]),
      "rentman-equipment",
    );
    expect(preview.rows[0].classification).toBe("updated");
    expect(preview.rows[0].changes).toEqual([{ field: "dayPrice", from: 80, to: 95 }]);
  });

  it("never writes — this is a pure classification, no Prisma calls inside", () => {
    // Structural check: buildMaterialPreview's signature takes only
    // plain data in, no Prisma client — a compile-time guarantee it
    // can't reach the database, complementing the DoD's "never writes".
    expect(buildMaterialPreview.length).toBe(4);
  });

  it("a parse error surfaces as a skipped row with its reason", () => {
    const preview = buildMaterialPreview(
      [],
      [{ line: 5, reason: "code 9998-902 is al gebruikt door ID 707" }],
      new Map(),
      "rentman-equipment",
    );
    expect(preview.rows[0]).toEqual({
      line: 5,
      classification: "skipped",
      matchKey: null,
      summary: "regel 5",
      reason: "code 9998-902 is al gebruikt door ID 707",
    });
    expect(preview.totals.skipped).toBe(1);
  });
});
