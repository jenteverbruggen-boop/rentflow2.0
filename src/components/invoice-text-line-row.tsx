"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { InvoiceLine } from "@/types";

interface Props {
  line: InvoiceLine;
  editable: boolean;
  onUpdate?: (values: { description: string }) => void;
  onDelete?: () => void;
}

/** C8 — a free-text paragraph spanning the whole row: no quantity, price or
 * VAT cells, so it reads as a remark on the document, not as an amount. */
export function InvoiceTextLineRow({ line, editable, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(line.description);

  function save() {
    if (text.trim()) onUpdate?.({ description: text.trim() });
    setEditing(false);
  }

  return (
    <tr className="border-b last:border-0">
      <td colSpan={5} className="py-2 pl-3 pr-4 text-sm align-top">
        {editing ? (
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        ) : (
          <p className="whitespace-pre-line text-foreground">{line.description}</p>
        )}
      </td>
      {editable && (
        <td className="py-2 pr-3 text-right whitespace-nowrap align-top">
          {editing ? (
            <>
              <Button size="sm" variant="ghost" onClick={save}>Opslaan</Button>
              <Button size="sm" variant="ghost" onClick={() => { setText(line.description); setEditing(false); }}>Annuleren</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" aria-label="Tekst bewerken" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" aria-label="Tekst verwijderen" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </td>
      )}
    </tr>
  );
}
