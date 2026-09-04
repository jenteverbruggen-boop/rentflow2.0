import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Note } from "@/types";

interface Props {
  target: Note | null;
  onConfirm: (note: Note) => void;
  onClose: () => void;
}

export function NoteDeleteDialog({ target, onConfirm, onClose }: Props) {
  return (
    <AlertDialog open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Notitie verwijderen?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{target?.title}&quot; en de bijhorende foto&apos;s worden definitief verwijderd.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction onClick={() => target && onConfirm(target)}>Verwijderen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
