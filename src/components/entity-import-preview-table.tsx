import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ImportPreview, ImportRowPreview } from "@/lib/import/pipeline-client-types";

const CLASSIFICATION_LABEL: Record<ImportRowPreview["classification"], string> = {
  new: "Nieuw",
  updated: "Gewijzigd",
  unchanged: "Ongewijzigd",
  skipped: "Overgeslagen",
  errored: "Fout",
};

const CLASSIFICATION_VARIANT: Record<ImportRowPreview["classification"], "default" | "secondary" | "outline" | "destructive"> = {
  new: "default",
  updated: "secondary",
  unchanged: "outline",
  skipped: "destructive",
  errored: "destructive",
};

function RowDetail({ row }: { row: ImportRowPreview }) {
  if (row.reason) return <span className="text-sm text-muted-foreground">{row.reason}</span>;
  if (!row.changes?.length) return null;
  return (
    <ul className="text-sm text-muted-foreground space-y-0.5">
      {row.changes.map((c) => (
        <li key={c.field}>
          {c.field}: {String(c.from ?? "—")} → {String(c.to ?? "—")}
        </li>
      ))}
    </ul>
  );
}

/** P3.4 — generalised from material-import-preview-table.tsx (M1.5);
 * additionally renders the replace-mode-only blocker list and delete
 * preview (§5/§7.3). */
export function EntityImportPreviewTable({ preview }: { preview: ImportPreview }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="default">Nieuw: {preview.totals.new}</Badge>
        <Badge variant="secondary">Gewijzigd: {preview.totals.updated}</Badge>
        <Badge variant="outline">Ongewijzigd: {preview.totals.unchanged}</Badge>
        <Badge variant="destructive">Overgeslagen: {preview.totals.skipped}</Badge>
        {preview.totals.errored > 0 && (
          <Badge variant="destructive">Fout: {preview.totals.errored}</Badge>
        )}
      </div>

      {preview.mode === "replace" && preview.blockers && preview.blockers.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 space-y-2">
          <p className="text-sm font-medium text-destructive">
            Vervangen geblokkeerd — {preview.blockers.length} bestaande rij(en) zijn nog gekoppeld:
          </p>
          <ul className="text-sm space-y-1">
            {preview.blockers.map((b) => (
              <li key={b.entityId}>
                <span className="font-medium">{b.label}</span>:{" "}
                {b.blockedBy.map((r) => `${r.relation} (${r.count})`).join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview.mode === "replace" && preview.toDelete && (
        <p className="text-sm text-muted-foreground">
          Vervangen verwijdert alle {preview.toDelete.length} bestaande rij(en) en laadt de {preview.totals.new} rij(en) uit dit bestand.
        </p>
      )}

      <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Regel</TableHead>
              <TableHead>Omschrijving</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.rows.map((row) => (
              <TableRow key={`${row.line}-${row.matchKey ?? ""}`}>
                <TableCell className="text-muted-foreground">{row.line}</TableCell>
                <TableCell className="min-w-0 truncate">{row.summary}</TableCell>
                <TableCell>
                  <Badge variant={CLASSIFICATION_VARIANT[row.classification]}>
                    {CLASSIFICATION_LABEL[row.classification]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <RowDetail row={row} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
