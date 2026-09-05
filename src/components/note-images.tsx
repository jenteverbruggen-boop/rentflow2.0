"use client";

import { useRef, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useNote } from "@/hooks/use-notes";
import { useNoteImageMutations } from "@/hooks/use-note-images";
import type { NoteImage } from "@/types";

interface Props {
  noteId: number;
  editable: boolean;
}

const MAX_IMAGES_PER_NOTE = 10;

/** Full upload/delete photo manager — lives in the edit dialog only.
 * Fetches its own live copy of the note (rather than taking `images` as
 * a prop) so an upload/delete shows up immediately: the dialog's
 * `defaultValues` is a snapshot taken when "Bewerken" was clicked and
 * doesn't itself update as mutations invalidate the notes query. */
export function NoteImages({ noteId, editable }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState<NoteImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: note } = useNote(noteId);
  const { upload, remove } = useNoteImageMutations(noteId);
  const images = note?.images ?? [];

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setError(null);

    const remaining = MAX_IMAGES_PER_NOTE - images.length;
    const toUpload = files.slice(0, remaining);
    if (files.length > toUpload.length) {
      setError(`Maximaal ${MAX_IMAGES_PER_NOTE} foto's per notitie — ${files.length - toUpload.length} niet geselecteerd`);
    }
    if (toUpload.length === 0) return;
    upload.mutate(toUpload, { onError: (err) => setError(err.message) });
  }

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img) => (
            <div key={img.id} className="relative group">
              <a href={`/api/note-images/${img.id}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/note-images/${img.id}`}
                  alt={img.filename}
                  className="h-20 w-20 rounded-md border border-border object-cover"
                />
              </a>
              {editable && (
                <button
                  type="button"
                  onClick={() => setDeleting(img)}
                  className="absolute -right-1 -top-1 rounded-full bg-destructive text-destructive-foreground text-xs w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {editable && images.length < MAX_IMAGES_PER_NOTE && (
        <>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
            {upload.isPending ? "Uploaden..." : "📷 Foto's toevoegen"}
          </Button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
        </>
      )}
      {error && <p className="text-xs text-destructive whitespace-pre-line">{error}</p>}

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Foto verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>&quot;{deleting?.filename}&quot; definitief verwijderen?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleting) remove.mutate(deleting.id); setDeleting(null); }}>
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
