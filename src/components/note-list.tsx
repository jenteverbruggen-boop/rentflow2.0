import { NoteCard } from "@/components/note-card";
import type { Note } from "@/types";

interface Props {
  notes: Note[];
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
  hideLinkBadge?: boolean;
  emptyMessage?: string;
}

export function NoteList({ notes, onEdit, onDelete, hideLinkBadge, emptyMessage }: Props) {
  if (notes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyMessage ?? "Nog geen notities — leg vast wat je met een klant besprak."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onEdit={onEdit} onDelete={onDelete} hideLinkBadge={hideLinkBadge} />
      ))}
    </div>
  );
}
