import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildXlsxBuffer, type ExportColumn } from "@/lib/export/xlsx-writer";

const COLUMNS: ExportColumn[] = [
  { key: "id", header: "id", type: "number" },
  { key: "name", header: "name", type: "string" },
  { key: "dayPrice", header: "dayPrice", type: "number" },
  { key: "archived", header: "archived", type: "boolean" },
  { key: "createdAt", header: "createdAt", type: "date" },
];

async function readBack(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return workbook.worksheets[0];
}

describe("buildXlsxBuffer (P2.1)", () => {
  it("writes the header row exactly as given", async () => {
    const buffer = await buildXlsxBuffer("Test", COLUMNS, []);
    const sheet = await readBack(buffer);
    const headerRow = sheet.getRow(1);
    expect(headerRow.getCell(1).value).toBe("id");
    expect(headerRow.getCell(2).value).toBe("name");
  });

  it("writes money and count columns as real numbers, not strings", async () => {
    const buffer = await buildXlsxBuffer("Test", COLUMNS, [
      { id: 1, name: "Tent", dayPrice: 45.5, archived: false, createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
    const sheet = await readBack(buffer);
    const row = sheet.getRow(2);
    expect(typeof row.getCell(1).value).toBe("number");
    expect(row.getCell(1).value).toBe(1);
    expect(typeof row.getCell(3).value).toBe("number");
    expect(row.getCell(3).value).toBe(45.5);
  });

  it("writes booleans and dates with their real types", async () => {
    const buffer = await buildXlsxBuffer("Test", COLUMNS, [
      { id: 1, name: "Tent", dayPrice: 0, archived: true, createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
    const sheet = await readBack(buffer);
    const row = sheet.getRow(2);
    expect(row.getCell(4).value).toBe(true);
    expect(row.getCell(5).value).toBeInstanceOf(Date);
  });

  it("writes null for a missing value rather than throwing or stringifying 'null'", async () => {
    const buffer = await buildXlsxBuffer("Test", COLUMNS, [
      { id: 2, name: "No price", dayPrice: null, archived: false, createdAt: null },
    ]);
    const sheet = await readBack(buffer);
    const row = sheet.getRow(2);
    expect(row.getCell(3).value).toBeNull();
  });

  it("an empty row list still produces a valid, readable workbook with just the header", async () => {
    const buffer = await buildXlsxBuffer("Test", COLUMNS, []);
    const sheet = await readBack(buffer);
    expect(sheet.rowCount).toBe(1);
  });

  it("omitting a column from the schema entirely means it never appears in the header", async () => {
    const buffer = await buildXlsxBuffer("Test", COLUMNS.slice(0, 2), [{ id: 1, name: "Tent" }]);
    const sheet = await readBack(buffer);
    expect(sheet.getRow(1).getCell(1).value).toBe("id");
    expect(sheet.getRow(1).getCell(2).value).toBe("name");
    expect(sheet.getRow(1).getCell(3).value).toBeNull();
  });
});
