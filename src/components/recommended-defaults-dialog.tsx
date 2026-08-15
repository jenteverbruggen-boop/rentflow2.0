import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DefaultsDiffRow } from "@/lib/recommended-permissions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: DefaultsDiffRow[];
  onApply: () => void;
  isPending: boolean;
}

const LEVEL_LABEL: Record<string, string> = {
  geen: "Geen",
  lezen: "Lezen",
  wijzigen: "Wijzigen",
  verwijderen: "Verwijderen",
};

/** The exact per-cell before/after diff shown before applying the
 * recommended defaults (N3.3) — a table, not a prose summary, since the
 * PO reads this before committing to a security-relevant change. */
export function RecommendedDefaultsDialog({ open, onOpenChange, rows, onApply, isPending }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Aanbevolen standaarden toepassen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              De systeemrollen komen al overeen met de aanbevolen standaarden.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rol</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Nu</TableHead>
                  <TableHead>Wordt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{r.roleLabel}</TableCell>
                    <TableCell className="text-sm">{r.moduleLabel}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{LEVEL_LABEL[r.before]}</TableCell>
                    <TableCell className="text-xs font-medium">{LEVEL_LABEL[r.after]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button type="button" disabled={isPending || rows.length === 0} onClick={onApply}>
              {isPending ? "Bezig…" : "Toepassen"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
