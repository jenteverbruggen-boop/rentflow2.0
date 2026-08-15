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
import type { RoleOption } from "@/hooks/use-roles";

interface Props {
  target: RoleOption | null;
  isPending: boolean;
  error: string;
  onConfirm: (role: RoleOption) => void;
  onClose: () => void;
}

/** Mirrors users/delete-user-dialog.tsx's pattern (N3.1). Shows the API's
 * conflict message (system role, or users still assigned) inline rather
 * than only relying on the disabled state. */
export function RoleDeleteDialog({ target, isPending, error, onConfirm, onClose }: Props) {
  return (
    <AlertDialog open={!!target} onOpenChange={(v) => { if (!v) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rol verwijderen?</AlertDialogTitle>
          <AlertDialogDescription>
            Weet je zeker dat je <strong>{target?.label}</strong> wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              if (target) onConfirm(target);
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Verwijderen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
