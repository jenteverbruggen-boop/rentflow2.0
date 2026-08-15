import ExcelJS from "exceljs";
import { parseCsv } from "@/lib/csv-parser";

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * M1.1 — reads either a .csv or a .xlsx file into the same shape.
 * `.csv` reuses the generic parser DDL-2 extracted out of seed.ts.
 * `.xlsx` uses exceljs (a library, not hand-rolled — the ZIP+XML
 * reader that would otherwise be needed is exactly the kind of thing
 * worth a well-maintained dependency for rather than reinventing).
 */
export async function parseImportFile(buffer: Buffer, filename: string): Promise<ParsedFile> {
  const isXlsx = filename.toLowerCase().endsWith(".xlsx");
  if (!isXlsx) {
    const rows = parseCsv(buffer.toString("utf8"));
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { headers, rows };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Geen werkblad gevonden in dit .xlsx-bestand");

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "").trim();
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      const cell = row.getCell(i + 1);
      const value = cell.value;
      record[header] = value == null ? "" : String(value instanceof Date ? value.toISOString() : value);
    });
    rows.push(record);
  });

  return { headers, rows };
}
