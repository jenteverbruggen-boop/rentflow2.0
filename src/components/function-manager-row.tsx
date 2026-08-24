"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { canHardDeleteFunction } from "@/lib/function-deletable";
import type { Function as Fn } from "@/types";

interface Props {
  fn: Fn;
  onEdit: (fn: Fn) => void;
  onArchive: (fn: Fn) => void;
  onRestore: (fn: Fn) => void;
  onDelete: (fn: Fn) => void;
}

function formatRate(v: number | null): string {
  return v == null ? "—" : `€${v.toFixed(2)}`;
}

function formatUsage(fn: Fn): string {
  const c = fn._count;
  if (!c) return "—";
  const parts: string[] = [];
  if (c.people > 0) parts.push(`${c.people} pers.`);
  if (c.assignments > 0) parts.push(`${c.assignments} boek.`);
  if (c.clientRates > 0) parts.push(`${c.clientRates} klant.`);
  return parts.length ? parts.join(", ") : "ongebruikt";
}

/** One row in FunctionsManagerDialog's table, extracted to respect the
 * 150-line limit. "Verwijderen" only ever shows for a genuinely unused
 * function — mirrors the DELETE route's own canHardDeleteFunction check
 * (src/lib/function-deletable.ts) — every other row only offers
 * "Archiveren", since a hard delete there would 409 anyway. */
export function FunctionManagerRow({ fn, onEdit, onArchive, onRestore, onDelete }: Props) {
  const usage = fn._count ?? { people: 0, assignments: 0, clientRates: 0 };
  const deletable = canHardDeleteFunction(usage);
  return (
    <TableRow>
      <TableCell className="font-medium">
        <span className="flex items-center gap-1.5">
          <span className="truncate">{fn.name}</span>
          {fn.archived && (
            <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
              Gearchiveerd
            </Badge>
          )}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">{formatRate(fn.dayRate)}</TableCell>
      <TableCell className="text-muted-foreground text-xs">{formatRate(fn.hourRate)}</TableCell>
      <TableCell className="text-muted-foreground text-xs">{formatUsage(fn)}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onEdit(fn)}>Bewerken</Button>
          {fn.archived ? (
            <Button variant="ghost" size="sm" onClick={() => onRestore(fn)}>Herstellen</Button>
          ) : deletable ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(fn)}
            >
              Verwijderen
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onArchive(fn)}>Archiveren</Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
