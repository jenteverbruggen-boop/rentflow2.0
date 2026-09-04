"use client";

import { useRef, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useNoteImageMutations } from "@/hooks/use-note-images";
import type { NoteImage } from "@/types";

interface Props {
  noteId: number;
  images: NoteImage[];
  editable: boolean;
}

const MAX_IMAGES_PER_NOTE = 10;

export function NoteImages({ noteId, images, editable }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState<NoteImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { upload, remove } = useNoteImageMutations(noteId);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    upload.mutate(file, { onError: (err) => setError(err.message) });
  }

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img) => (
            <div key={img.id} className="relative group">
              <a href={`/api/note-images/${img.id}`} target="_blank" rel="noreferrer">
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
            {upload.isPending ? "Uploaden..." : "📷 Foto toevoegen"}
          </Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

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
