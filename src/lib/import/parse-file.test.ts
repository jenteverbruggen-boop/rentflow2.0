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
});
