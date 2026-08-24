import { describe, it, expect } from "vitest";
import { detectFormat } from "@/lib/import/format-detection";
import { parseMaterialRows } from "@/lib/import/material-adapter";
import { normalizeRentmanLocale } from "@/lib/import/rentman-locale";

const DUTCH_HEADERS = [
  "ID",
  "Code",
  "Naam (in database)",
  "Opmerking intern",
  "Map (Map)",
  "Type materiaal",
  "Archived",
  "Display in planner",
  "Methode voorraadberekening",
  "Huidig aantal",
  "Verhuur-/verkoopprijs",
  "Margeprijs",
  "Nieuwprijs",
];

function dutchRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    ID: "1",
    Code: "0501-001",
    "Naam (in database)": "Partytent",
    "Opmerking intern": "",
    "Map (Map)": "05-Tenten",
    "Type materiaal": "Fysiek item",
    Archived: "0",
    "Display in planner": "1",
    "Methode voorraadberekening": "Bulk",
    "Huidig aantal": "3",
    "Verhuur-/verkoopprijs": "95",
    Margeprijs: "50",
    Nieuwprijs: "1200",
    ...overrides,
  };
}

describe("normalizeRentmanLocale", () => {
  it("translates Dutch headers to the canonical English ones detectFormat expects", () => {
    const { headers } = normalizeRentmanLocale(DUTCH_HEADERS, [dutchRow()]);
    expect(detectFormat(headers)).toBe("rentman-equipment");
  });

  it("is a no-op on an already-English Rentman export", () => {
    const englishHeaders = ["Code", "Folder (Folder)", "Stock calculation method", "Type of equipment"];
    const englishRow = {
      Code: "0501-001",
      "Folder (Folder)": "05-Tenten",
      "Stock calculation method": "Bulk",
      "Type of equipment": "Physical item",
    };
    const { headers, rows } = normalizeRentmanLocale(englishHeaders, [englishRow]);
    expect(headers).toEqual(englishHeaders);
    expect(rows).toEqual([englishRow]);
  });

  it("is a no-op on RentFlow's own lower-camel CSV headers", () => {
    const rentflowHeaders = ["name", "code", "dayPrice"];
    const rentflowRow = { name: "Tent", code: "0501-001", dayPrice: "95" };
    const { headers, rows } = normalizeRentmanLocale(rentflowHeaders, [rentflowRow]);
    expect(headers).toEqual(rentflowHeaders);
    expect(rows).toEqual([rentflowRow]);
  });

  it("translates the Dutch 'Serialized' and bundle enum values the parser matches on", () => {
    const { headers, rows } = normalizeRentmanLocale(DUTCH_HEADERS, [
      dutchRow({ "Type materiaal": "Virtuele combinatie" }),
      dutchRow({ ID: "2", Code: "0501-002", "Methode voorraadberekening": "Geserialiseerd" }),
    ]);
    const format = detectFormat(headers);
    const { materials } = parseMaterialRows(rows, format);
    expect(materials.find((m) => m.externalId === "1")?.isBundle).toBe(true);
    const serialized = materials.find((m) => m.externalId === "2");
    expect(serialized?.stockItems).toHaveLength(1);
    expect(serialized?.stockItems[0]).toEqual({ identifier: null, notes: null });
  });

  it("end-to-end: a Dutch export parses to the same material as its English equivalent", () => {
    const dutch = normalizeRentmanLocale(DUTCH_HEADERS, [dutchRow()]);
    const dutchFormat = detectFormat(dutch.headers);
    const { materials: dutchMaterials } = parseMaterialRows(dutch.rows, dutchFormat);

    const englishHeaders = [
      "ID",
      "Code",
      "Name (in database)",
      "Internal remark",
      "Folder (Folder)",
      "Type of equipment",
      "Archived",
      "Display in planner",
      "Stock calculation method",
      "Current quantity",
      "Rental-/Sales price",
      "Margin price",
      "List price",
    ];
    const englishRow = {
      ID: "1",
      Code: "0501-001",
      "Name (in database)": "Partytent",
      "Internal remark": "",
      "Folder (Folder)": "05-Tenten",
      "Type of equipment": "Physical item",
      Archived: "0",
      "Display in planner": "1",
      "Stock calculation method": "Bulk",
      "Current quantity": "3",
      "Rental-/Sales price": "95",
      "Margin price": "50",
      "List price": "1200",
    };
    const { materials: englishMaterials } = parseMaterialRows([englishRow], detectFormat(englishHeaders));

    expect(dutchMaterials).toEqual(englishMaterials);
  });
});
