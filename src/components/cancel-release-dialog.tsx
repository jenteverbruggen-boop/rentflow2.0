"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ProjectReleaseSummary } from "@/types";

interface Props {
  summary: ProjectReleaseSummary | null;
  onClose: () => void;
}

/** Shown after cancelling a project: what stock was freed, what is still
 * physically out, and which suppliers still have to be called off. */
export function CancelReleaseDialog({ summary, onClose }: Props) {
  const hasInfo = !!summary && (summary.released > 0 || summary.keptShipped.length > 0 || summary.hired.length > 0);
  return (
    <AlertDialog open={hasInfo} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Project geannuleerd</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>{summary?.released ?? 0} unit(s) vrijgegeven — ze zijn meteen weer beschikbaar voor andere projecten.</p>
              {(summary?.keptShipped.length ?? 0) > 0 && (
                <div>
                  <p className="font-medium">Nog buiten (niet teruggebracht):</p>
                  <ul className="list-disc pl-5">
                    {summary?.keptShipped.map((k) => <li key={`${k.period}|${k.material}`}>{k.quantity}× {k.material} ({k.period})</li>)}
                  </ul>
                </div>
              )}
              {(summary?.hired.length ?? 0) > 0 && (
                <div className="text-amber-700 dark:text-amber-500">
                  <p className="font-medium">Vergeet niet af te bellen:</p>
                  <ul className="list-disc pl-5">
                    {summary?.hired.map((h) => <li key={`${h.supplier}|${h.period}|${h.material}`}>{h.quantity}× {h.material} bij {h.supplier}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>Sluiten</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
