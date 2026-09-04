import { format } from "date-fns";
import { nl } from "date-fns/locale";
import type { Note } from "@/types";

function fmt(iso: string): string {
  return format(new Date(iso), "d MMM yyyy 'om' HH:mm", { locale: nl });
}

/** Who created/last edited a note, and when — the audit trail the PO
 * asked to be able to check. */
export function NoteAuditLine({ note }: { note: Note }) {
  return (
    <p className="text-xs text-muted-foreground">
      {note.createdByName} · {fmt(note.createdAt)}
      {note.updatedByName && note.updatedAt !== note.createdAt && (
        <> · laatst gewijzigd door {note.updatedByName} · {fmt(note.updatedAt)}</>
      )}
    </p>
  );
}
