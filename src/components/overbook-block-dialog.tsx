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
import type { BlockingShortage } from "@/hooks/use-project-status-mutation";

interface Props {
  shortages: BlockingShortage[] | null;
  /** Any other reason the status change failed. Shown in the same dialog
   * so a plain failure can no longer be swallowed silently either. */
  message?: string;
  onClose: () => void;
}

/**
 * Overboeken — the blocking popup on a refused status change. Deliberately
 * has no "toch doorzetten" action: overbooked material is allowed to sit in
 * concept/geannuleerd, but committing the project to it is exactly what
 * must not happen. The server already tried to auto-assign before
 * refusing, so what is listed here genuinely does not exist yet.
 */
export function OverbookBlockDialog({ shortages, message, onClose }: Props) {
  const overbooked = !!shortages?.length;
  const open = overbooked || !!message;
  const total = (shortages ?? []).reduce((s, l) => s + l.quantity, 0);

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Status niet gewijzigd</AlertDialogTitle>
          <AlertDialogDescription asChild>
            {!overbooked ? (
              <p>{message}</p>
            ) : (
            <div className="space-y-2">
              <p>
                Dit project heeft {total} overboekte unit(s) — materiaal dat
                niet in voorraad is. Een project kan alleen concept of
                geannuleerd blijven zolang dat zo is.
              </p>
              <ul className="space-y-0.5 text-amber-600 dark:text-amber-500">
                {(shortages ?? []).map((s) => (
                  <li key={s.id}>
                    ⚠ {s.periodName} · {s.materialName} · {s.quantity} overboekt
                  </li>
                ))}
              </ul>
              <p>
                Koop de voorraad bij en gebruik <b>Toewijzen</b> op de
                Materialen-tab, of verlaag het geboekte aantal.
              </p>
            </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>Sluiten</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
