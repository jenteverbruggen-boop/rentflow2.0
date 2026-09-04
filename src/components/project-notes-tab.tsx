"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NoteList } from "@/components/note-list";
import { NoteFormDialog } from "@/components/note-form-dialog";
import { NoteDeleteDialog } from "@/components/note-delete-dialog";
import { useNotes, useNoteMutations, type NoteFormValues } from "@/hooks/use-notes";
import type { Note, Project } from "@/types";

interface Props {
  project: Project;
}

export function ProjectNotesTab({ project }: Props) {
  const { data: notes = [] } = useNotes({ projectId: project.id });
  const { create, update, remove } = useNoteMutations();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState<Note | null>(null);

  function submit(values: NoteFormValues) {
    if (editing) update.mutate({ id: editing.id, values }, { onSuccess: () => setFormOpen(false) });
    else create.mutate(values, { onSuccess: () => setFormOpen(false) });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Notities</h3>
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>+ Notitie</Button>
      </div>

      <NoteList
        notes={notes}
        onEdit={(note) => { setEditing(note); setFormOpen(true); }}
        onDelete={setDeleting}
        hideLinkBadge
        emptyMessage="Nog geen notities voor dit project."
      />

      <NoteFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultValues={editing}
        initialProjectId={project.id}
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
