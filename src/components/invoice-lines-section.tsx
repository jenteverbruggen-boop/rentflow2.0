import { InvoiceLineRow } from "@/components/invoice-line-row";
import type { InvoiceLine } from "@/types";

interface Props {
  lines: InvoiceLine[];
  editable: boolean;
  onUpdateLine?: (lineId: number, values: { description: string; quantity: number; unitPrice: number }) => void;
  onDeleteLine?: (lineId: number) => void;
}

/** J2b.7 — one period "section" heading + its rows, used both on
 * screen (this file) and in print (facturen/:id/print's read-only
 * reuse). Lines with no section (deposit/deduction/manual) group
 * under a blank heading at the top. */
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
                {sectionLines.map((line) => (
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
