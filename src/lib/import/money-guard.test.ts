import { describe, it, expect } from "vitest";
import { redactPreviewMoney, rejectedMoneyImportHeader } from "@/lib/import/money-guard";
import type { ImportPreview } from "@/lib/import/pipeline-types";
import type { ResolvedAccess } from "@/lib/api-auth";

const withMoney: ResolvedAccess = { id: 1, personId: null, scope: "all", permissions: { kosten_facturen: "lezen" } };
const withoutMoney: ResolvedAccess = { id: 2, personId: null, scope: "all", permissions: { kosten_facturen: "geen" } };
const canWriteMoney: ResolvedAccess = { id: 3, personId: null, scope: "all", permissions: { kosten_facturen: "wijzigen" } };

function makePreview(entity: ImportPreview["entity"]): ImportPreview {
  return {
    entity,
    mode: "update",
    sourceFormat: "rentflow",
    totals: { new: 0, updated: 1, unchanged: 0, skipped: 0, errored: 0 },
    rows: [
      {
        line: 2,
        classification: "updated",
        matchKey: "0501-001",
        summary: "Tent",
        changes: [
          { field: "dayPrice", from: 50, to: 60 },
          { field: "name", from: "Tent", to: "Tent XL" },
        ],
      },
    ],
  };
}

describe("redactPreviewMoney (review finding — import preview money leak)", () => {
  it("strips money-field changes for a caller without Kosten/Facturen access", () => {
    const result = redactPreviewMoney(makePreview("materials"), withoutMoney);
    const fields = result.rows[0].changes!.map((c) => c.field);
    expect(fields).not.toContain("dayPrice");
    expect(fields).toContain("name");
  });

  it("keeps money-field changes intact for a caller with access", () => {
    const result = redactPreviewMoney(makePreview("materials"), withMoney);
    const fields = result.rows[0].changes!.map((c) => c.field);
    expect(fields).toContain("dayPrice");
  });

  it("is a no-op for an entity with no money columns (clients/locations)", () => {
    const preview = makePreview("clients");
    const result = redactPreviewMoney(preview, withoutMoney);
    expect(result).toBe(preview);
  });

  it("never crashes on a row with no changes (a 'new' row)", () => {
    const preview = makePreview("materials");
    preview.rows[0].changes = undefined;
    const result = redactPreviewMoney(preview, withoutMoney);
    expect(result.rows[0].changes).toBeUndefined();
  });
});

describe("rejectedMoneyImportHeader (review finding — import write-side money gate)", () => {
  it("refuses a materials import whose file has a dayPrice column, without Kosten/Facturen: wijzigen", () => {
    expect(rejectedMoneyImportHeader("materials", ["name", "code", "dayPrice"], withoutMoney)).toBe("dayPrice");
  });

  it("allows it through when the caller has Kosten/Facturen: wijzigen", () => {
    expect(rejectedMoneyImportHeader("materials", ["name", "code", "dayPrice"], canWriteMoney)).toBeNull();
  });

  it("allows a materials import with no money column present regardless of access", () => {
    expect(rejectedMoneyImportHeader("materials", ["name", "code"], withoutMoney)).toBeNull();
  });

  it("clients/locations never have a money column to reject", () => {
    expect(rejectedMoneyImportHeader("clients", ["name", "vatNumber"], withoutMoney)).toBeNull();
    expect(rejectedMoneyImportHeader("locations", ["name"], withoutMoney)).toBeNull();
  });
});
