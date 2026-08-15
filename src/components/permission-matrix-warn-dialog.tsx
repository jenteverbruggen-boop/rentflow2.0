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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

/** Confirms a save that would remove the current user's own access
 * (N3.2) — extracted to keep permission-matrix.tsx under 150 lines. */
export function PermissionMatrixWarnDialog({ open, onOpenChange, onConfirm, isPending }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Dit vermindert je eigen toegang</AlertDialogTitle>
          <AlertDialogDescription>
            Deze wijziging verlaagt de toegang van je eigen rol op minstens één module. Je kunt na het opslaan mogelijk
            zelf niet meer terugkomen op deze wijziging. Weet je zeker dat je wilt doorgaan?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={onConfirm}>
            {isPending ? "Bezig…" : "Toch opslaan"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
