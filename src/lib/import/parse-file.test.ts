import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseImportFile } from "@/lib/import/parse-file";

describe("parseImportFile (M1.1)", () => {
  it("parses a .csv buffer into headers + rows", async () => {
    const csv = "name,code,dayPrice\nTent,0501-001,95\n";
    const result = await parseImportFile(Buffer.from(csv, "utf8"), "materials.csv");
    expect(result.headers).toEqual(["name", "code", "dayPrice"]);
    expect(result.rows).toEqual([{ name: "Tent", code: "0501-001", dayPrice: "95" }]);
  });

  it("parses a real .xlsx buffer (round-tripped through exceljs) into the same shape", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Materials");
    sheet.addRow(["name", "code", "dayPrice"]);
    sheet.addRow(["Tent", "0501-001", 95]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await parseImportFile(buffer, "materials.xlsx");
    expect(result.headers).toEqual(["name", "code", "dayPrice"]);
    expect(result.rows).toEqual([{ name: "Tent", code: "0501-001", dayPrice: "95" }]);
  });

  // B4 (round 3 PO feedback) — encoding detection. A Windows-1252/latin1
  // export used to decode as strict UTF-8 and silently mojibake
  // diacritics rather than failing loudly.
  describe("encoding detection", () => {
    it("strips a UTF-8 BOM before parsing", async () => {
      const csv = "name,city\nTent,Gent\n";
      const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(csv, "utf8")]);
      const result = await parseImportFile(withBom, "clients.csv");
      expect(result.headers).toEqual(["name", "city"]);
      expect(result.rows).toEqual([{ name: "Tent", city: "Gent" }]);
    });

    it("parses valid UTF-8 diacritics correctly", async () => {
      const csv = "name,city\nFêteparty,Kortenberg\n";
      const buffer = Buffer.from(csv, "utf8");
      const result = await parseImportFile(buffer, "clients.csv");
      expect(result.rows).toEqual([{ name: "Fêteparty", city: "Kortenberg" }]);
    });

    it("falls back to latin1 when the bytes are not valid UTF-8, preserving diacritics", async () => {
      const csv = "name,city\nFêteparty,Genève\n";
      // latin1/Windows-1252 encodes é and è as single bytes that are not
      // valid UTF-8 continuation sequences on their own — this buffer
      // would throw under a strict UTF-8 decode.
      const buffer = Buffer.from(csv, "latin1");
      const result = await parseImportFile(buffer, "clients.csv");
      expect(result.rows).toEqual([{ name: "Fêteparty", city: "Genève" }]);
    });
  });
});
