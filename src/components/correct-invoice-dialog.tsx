import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string | null;
  onConfirm: () => void;
}

/** A sent invoice is never edited; correcting it means crediting it and
 * issuing a new one. Say so before doing it. */
export function CorrectInvoiceDialog({ open, onOpenChange, invoiceNumber, onConfirm }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Factuur {invoiceNumber} corrigeren?</AlertDialogTitle>
          <AlertDialogDescription>
            Een verzonden factuur wordt nooit aangepast. Er worden twee concepten gemaakt: een creditnota
            voor het volledige bedrag en een nieuwe factuur met dezelfde regels, die je daarna aanpast.
            Pas als je de nieuwe factuur finaliseert, gaan beide samen de deur uit. Eventuele betalingen
            schuiven mee naar de nieuwe factuur.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Corrigeren</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
