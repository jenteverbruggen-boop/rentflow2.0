import ExcelJS from "exceljs";

export type ExportColumnType = "string" | "number" | "date" | "boolean";

export interface ExportColumn {
  key: string;
  header: string;
  type: ExportColumnType;
}

/**
 * P2.1 — real `.xlsx` (Q61, 2026-08-15, superseding the design doc's own
 * older CSV recommendation). No new dependency: `exceljs` is already a
 * project dependency (M1.1's xlsx *reader* for imports); this is its
 * first use as a *writer*. Money as real numbers, dates as real Date
 * objects — never a pre-formatted string — so Excel can sum a money
 * column immediately.
 */
export async function buildXlsxBuffer(
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ key: c.key, header: c.header }));

  for (const row of rows) {
    const values: Record<string, unknown> = {};
    for (const col of columns) {
      values[col.key] = coerce(row[col.key], col.type);
    }
    sheet.addRow(values);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function coerce(value: unknown, type: ExportColumnType): unknown {
  if (value == null) return null;
  switch (type) {
    case "number":
      return typeof value === "number" ? value : Number(value);
    case "date":
      return value instanceof Date ? value : new Date(value as string);
    case "boolean":
      return Boolean(value);
    default:
      return String(value);
  }
}
