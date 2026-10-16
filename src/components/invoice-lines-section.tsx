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

/** J2b.7 — one period "section" heading + its rows, used both on
 * screen (this file) and in print (facturen/:id/print's read-only
 * reuse). Sections appear in order of their first line, so lines with
 * no section (deposit/deduction/manual/text) group under a blank
 * heading wherever the first of them sits — new free lines go last. */
export function InvoiceLinesSection({ lines, editable, onUpdateLine, onDeleteLine }: Props) {
  const sections = new Map<string, InvoiceLine[]>();
  for (const line of lines) {
    const key = line.section ?? "";
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key)!.push(line);
  }

  return (
    <div className="space-y-4">
      {[...sections.entries()].map(([section, sectionLines]) => (
        <div key={section || "—"} className="space-y-1">
          {section && <h3 className="text-sm font-semibold">{section}</h3>}
          <div className="border rounded-lg overflow-x-auto bg-card">
            <table className="w-full min-w-[560px]">
              <tbody>
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
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
