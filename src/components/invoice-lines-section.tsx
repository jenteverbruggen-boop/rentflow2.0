import { Fragment } from "react";
import { InvoiceLineRow } from "@/components/invoice-line-row";
import { InvoiceTextLineRow } from "@/components/invoice-text-line-row";
import type { InvoiceLine, InvoiceLineUnit } from "@/types";

type LineValues = { description: string; quantity: number; unitPrice: number; unit?: InvoiceLineUnit; vatRate?: number };

interface Props {
  lines: InvoiceLine[];
  editable: boolean;
  onUpdateLine?: (lineId: number, values: Partial<LineValues>) => void;
  onDeleteLine?: (lineId: number) => void;
}

/** J2b.7 — the lines of one invoice as a single table: a header row (which
 * repeats on every printed page), then one block per period "section" with
 * its own heading row. Used on screen and in print (facturen/:id/print's
 * read-only reuse). Sections appear in order of their first line, so lines
 * with no section (deposit/deduction/manual/text) group under no heading
 * wherever the first of them sits — new free lines go last. */
export function InvoiceLinesSection({ lines, editable, onUpdateLine, onDeleteLine }: Props) {
  const sections = new Map<string, InvoiceLine[]>();
  for (const line of lines) {
    const key = line.section ?? "";
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key)!.push(line);
  }
  const cols = editable ? 6 : 5;

  return (
    <div className="border rounded-lg overflow-x-auto bg-card print:border-0 print:rounded-none print:overflow-visible">
      <table className="doc-table w-full min-w-[640px] text-sm">
        <colgroup>
          <col />
          <col className="w-28" />
          <col className="w-28" />
          <col className="w-16" />
          <col className="w-28" />
          {editable && <col className="w-28" />}
        </colgroup>
        <thead>
          <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pl-3 pr-4 text-left font-medium">Omschrijving</th>
            <th className="py-2 pr-4 text-right font-medium">Aantal</th>
            <th className="py-2 pr-4 text-right font-medium">Prijs</th>
            <th className="py-2 pr-3 text-right font-medium">BTW</th>
            <th className="py-2 pr-3 text-right font-medium">Bedrag</th>
            {editable && <th aria-label="Acties" />}
          </tr>
        </thead>
        <tbody>
          {[...sections.entries()].map(([section, sectionLines]) => (
            <Fragment key={section || "—"}>
              {section && (
                <tr className="bg-muted/40">
                  <th colSpan={cols} className="py-1.5 pl-3 pr-3 text-left text-xs font-semibold uppercase tracking-wide">
                    {section}
                  </th>
                </tr>
              )}
              {sectionLines.map((line) => line.kind === "text" ? (
                <InvoiceTextLineRow
                  key={line.id}
                  line={line}
                  editable={editable}
                  onUpdate={(values) => onUpdateLine?.(line.id, values)}
                  onDelete={() => onDeleteLine?.(line.id)}
                />
              ) : (
                <InvoiceLineRow
                  key={line.id}
                  line={line}
                  editable={editable}
                  onUpdate={(values) => onUpdateLine?.(line.id, values)}
                  onDelete={() => onDeleteLine?.(line.id)}
                />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
