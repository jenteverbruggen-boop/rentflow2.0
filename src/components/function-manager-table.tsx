"use client";

import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FunctionManagerRow } from "@/components/function-manager-row";
import type { Function as Fn } from "@/types";

interface Props {
  functions: Fn[];
  showHeader?: boolean;
  onEdit: (fn: Fn) => void;
  onArchive: (fn: Fn) => void;
  onRestore: (fn: Fn) => void;
  onDelete: (fn: Fn) => void;
}

/** One functions table (active or archived section), extracted out of
 * FunctionsManagerDialog to keep both files under the 150-line limit. */
export function FunctionManagerTable({ functions, showHeader = true, onEdit, onArchive, onRestore, onDelete }: Props) {
  return (
    <div className="overflow-x-auto">
      <Table>
        {showHeader && (
          <TableHeader>
            <TableRow>
              <TableHead>Naam</TableHead>
              <TableHead>Dagtarief</TableHead>
              <TableHead>Uurtarief</TableHead>
              <TableHead>Gebruik</TableHead>
              <TableHead className="text-right">Acties</TableHead>
            </TableRow>
          </TableHeader>
        )}
        <TableBody>
          {functions.map((fn) => (
            <FunctionManagerRow
              key={fn.id}
              fn={fn}
              onEdit={onEdit}
              onArchive={onArchive}
              onRestore={onRestore}
              onDelete={onDelete}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
