"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NoteFilterBar } from "@/components/note-filter-bar";
import { NoteList } from "@/components/note-list";
import { NoteFormDialog } from "@/components/note-form-dialog";
import { NoteDeleteDialog } from "@/components/note-delete-dialog";
import { useNotes, useNoteMutations, type NoteFormValues, type NoteListFilter } from "@/hooks/use-notes";
import type { Note } from "@/types";

export default function NotesPage() {
  const [filter, setFilter] = useState<NoteListFilter>({});
  const { data: notes = [] } = useNotes(filter);
  const { create, update, remove } = useNoteMutations();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState<Note | null>(null);

  function submit(values: NoteFormValues) {
    if (editing) update.mutate({ id: editing.id, values }, { onSuccess: () => setFormOpen(false) });
    else create.mutate(values, { onSuccess: () => setFormOpen(false) });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Notities</h2>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>+ Nieuwe notitie</Button>
      </div>

      <NoteFilterBar filter={filter} onChange={setFilter} />

      <NoteList
        notes={notes}
        onEdit={(note) => { setEditing(note); setFormOpen(true); }}
        onDelete={setDeleting}
      />

      <NoteFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultValues={editing}
        onSubmit={submit}
        isPending={create.isPending || update.isPending}
      />

      <NoteDeleteDialog
        target={deleting}
        onConfirm={(note) => { remove.mutate(note.id); setDeleting(null); }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
