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
import type { Client } from "@/types";

interface Props {
  target: Client | null;
  error: string | null;
  onConfirm: (client: Client) => void;
  onClose: () => void;
}

/** Extracted from clients/page.tsx (L3.1) to make room for the new
 * "Tarieven" dialog trigger — pure move, no behaviour change. */
export function ClientDeleteDialog({ target, error, onConfirm, onClose }: Props) {
  return (
    <AlertDialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Klant verwijderen?</AlertDialogTitle>
          <AlertDialogDescription>
            {error ? (
              <span className="text-destructive">{error}</span>
            ) : (
              `"${target?.name}" definitief verwijderen?`
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          {!error && (
            <AlertDialogAction onClick={() => target && onConfirm(target)}>
              Verwijderen
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
