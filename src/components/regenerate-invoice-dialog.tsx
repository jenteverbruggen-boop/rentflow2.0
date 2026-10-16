import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The PO's own lines (free items, discounts, text) — they stay. */
  ownLineCount: number;
  onConfirm: () => void;
}

/** Regenerating recomputes every generated line from the project — also the
 * ones edited by hand — so ask first and say exactly what is kept. */
export function RegenerateInvoiceDialog({ open, onOpenChange, ownLineCount, onConfirm }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Opnieuw genereren?</AlertDialogTitle>
          <AlertDialogDescription>
            De regels uit het project worden opnieuw berekend. Aanpassingen die je aan die
            gegenereerde regels deed, gaan verloren.{" "}
            {ownLineCount > 0
              ? `Je ${ownLineCount === 1 ? "eigen regel blijft" : `${ownLineCount} eigen regels blijven`} behouden.`
              : "Je hebt geen eigen regels die dit raakt."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Opnieuw genereren</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
