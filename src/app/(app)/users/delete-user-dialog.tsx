"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { User } from "@/types";

interface Props {
  target: User | null;
  isPending: boolean;
  onConfirm: (user: User) => void;
  onClose: () => void;
}

export function DeleteUserDialog({ target, isPending, onConfirm, onClose }: Props) {
  return (
    <AlertDialog open={!!target} onOpenChange={(v) => { if (!v) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Gebruiker verwijderen?</AlertDialogTitle>
          <AlertDialogDescription>
            Weet je zeker dat je <strong>{target?.name}</strong> wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() => target && onConfirm(target)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Verwijderen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
