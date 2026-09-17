import ExcelJS from "exceljs";
import { parseCsv } from "@/lib/csv-parser";

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/**
 * B4 (round 3 PO feedback) — a Windows-1252/latin1 CSV export (common
 * from Belgian/Dutch-locale Excel) used to decode as strict UTF-8, so
 * every non-ASCII byte in a name or address silently mojibaked (é, ë, ï
 * become garbage) rather than failing loudly. Now: strip a UTF-8 BOM if
 * present (harmless on a file that never had one), then decode as
 * UTF-8; if that decode is not actually valid UTF-8 (Node's
 * `TextDecoder` in fatal mode throws), fall back to latin1 — every byte
 * value is a valid latin1 code point, so this never itself throws, and
 * for the common Windows-1252 case the printable range latin1 shares
 * with cp1252 covers exactly the accented Belgian/Dutch names/addresses
 * this bug report was about.
 */
function decodeCsvBuffer(buffer: Buffer): string {
  const withoutBom = buffer.subarray(0, UTF8_BOM.length).equals(UTF8_BOM) ? buffer.subarray(UTF8_BOM.length) : buffer;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(withoutBom);
  } catch {
    return withoutBom.toString("latin1");
  }
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
    const rows = parseCsv(decodeCsvBuffer(buffer));
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
