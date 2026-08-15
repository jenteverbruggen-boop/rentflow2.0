import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "@/lib/csv-parser";
import { detectFormat } from "@/lib/import/format-detection";
import { parseMaterialRows } from "@/lib/import/material-adapter";

const TOOLS_DIR = path.join(process.cwd(), ".plans", "tools");

function loadRows(filename: string) {
  const content = fs.readFileSync(path.join(TOOLS_DIR, filename), "utf8");
  return parseCsv(content);
}

describe("M1.1 — parsing the real Rentman equipment exports", () => {
  it("detects the normal file as rentman-equipment", () => {
    const rows = loadRows("Export_Equipment_normal.csv");
    expect(detectFormat(Object.keys(rows[0]))).toBe("rentman-equipment");
  });

  it("normal file: 113 rows collapse to 104 ID-groups, minus the one code collision, minus the 1 non-Serialized bulk row's own rules", () => {
    const rows = loadRows("Export_Equipment_normal.csv");
    const { materials, errors } = parseMaterialRows(rows, "rentman-equipment");
    // 104 unique IDs; ID 708 ("Messen (Vis)") is skipped as the
    // 9998-902 code collision (§2.2 — lowest ID, 707 "Vorken (vis)",
    // keeps the code).
    expect(materials.length + errors.length).toBe(104);
    expect(materials).toHaveLength(103);
    expect(errors).toHaveLength(1);
    expect(errors[0].reason).toContain("9998-902");
  });

  it("the 9998-902 collision resolves to the lowest ID, per the design doc's own corrected row (ID 707 = Vorken (vis))", () => {
    const rows = loadRows("Export_Equipment_normal.csv");
    const { materials } = parseMaterialRows(rows, "rentman-equipment");
    const kept = materials.find((m) => m.code === "9998-902");
    expect(kept?.externalId).toBe("707");
    expect(kept?.name).toBe("Vorken (vis)");
  });

  it("combination types: only Virtual combination becomes isBundle, Physical combination does not", () => {
    const rows = loadRows("Export_Equipment_normal.csv");
    const { materials } = parseMaterialRows(rows, "rentman-equipment");
    const virtualBundles = materials.filter((m) => m.isBundle);
    const schepijsVriezer = materials.find((m) => m.name === "Schepijs vriezer");
    expect(virtualBundles).toHaveLength(3);
    expect(schepijsVriezer?.isBundle).toBe(false);
    expect(schepijsVriezer?.stockItems.length).toBeGreaterThan(0);
    // Virtual combinations get no stock — their recipe is empty and
    // must be entered by hand (Combination structure is never populated).
    virtualBundles.forEach((b) => expect(b.stockItems).toHaveLength(0));
  });

  it("advanced file: all 287 rows import as archived, none as bundles", () => {
    const rows = loadRows("Export_Equipment_advanced.csv");
    const { materials, errors } = parseMaterialRows(rows, "rentman-equipment");
    expect(materials).toHaveLength(287);
    expect(errors).toHaveLength(0);
    expect(materials.every((m) => m.archived)).toBe(true);
    expect(materials.every((m) => !m.isBundle)).toBe(true);
  });

  it("category prefixes are the full 4-digit folder prefix, not truncated to 2 digits", () => {
    const rows = loadRows("Export_Equipment_normal.csv");
    const { materials } = parseMaterialRows(rows, "rentman-equipment");
    const prefixes = new Set(materials.map((m) => m.categoryPrefix).filter(Boolean));
    // The three folders that would have collided under a 2-digit
    // truncation (9997/9998/9999) must all be distinct here.
    expect(prefixes.has("9997")).toBe(true);
    expect(prefixes.has("9998")).toBe(true);
    expect(prefixes.has("9999")).toBe(true);
  });
});
