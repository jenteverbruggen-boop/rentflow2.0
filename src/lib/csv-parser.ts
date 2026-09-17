// Generic, format-agnostic CSV line/row parser — extracted out of
// prisma/seed.ts (DDL-2) so M1's import pipeline can reuse the exact
// same quote-aware line splitter instead of a second hand-rolled copy.
// Everything specific to one CSV's own column layout (header names,
// dedup key, category composition) stays with its caller — this file
// only turns raw text into rows of named fields.

export type CsvRecord = Record<string, string>;
export type CsvDelimiter = "," | ";";

export function parseCsvLine(line: string, delimiter: CsvDelimiter = ","): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields;
}

/**
 * B4 (round 3 PO feedback) — Belgian/Dutch-locale Excel writes CSV with
 * `;` because `,` is the decimal separator there; this codebase's own
 * export and most real-world CSVs use `,`. Sniffed once from the header
 * line by counting each delimiter candidate *outside quoted spans* (a
 * quoted field may itself contain the other delimiter, e.g. an address
 * "Kerkstraat 1, 9000 Gent" in a semicolon file) and picking whichever
 * is strictly more frequent — ties (including a single-column file with
 * neither present) keep the `,` default so existing comma-delimited
 * behaviour is unchanged.
 */
export function detectCsvDelimiter(headerLine: string): CsvDelimiter {
  const countOutsideQuotes = (line: string, char: string): number => {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          i += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (c === char && !inQuotes) count++;
    }
    return count;
  };

  const commaCount = countOutsideQuotes(headerLine, ",");
  const semicolonCount = countOutsideQuotes(headerLine, ";");
  return semicolonCount > commaCount ? ";" : ",";
}

export function parseCsv(content: string): CsvRecord[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const delimiter = detectCsvDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter);
  const rows: CsvRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter);
    const row: CsvRecord = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}
