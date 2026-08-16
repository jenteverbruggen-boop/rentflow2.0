import { Button } from "@/components/ui/button";
import type { ImportApplyResult } from "@/lib/import/pipeline-client-types";

interface Props {
  result: ImportApplyResult;
  onImportAnother: () => void;
  onClose: () => void;
}

/** P3.4 — generalised from material-import-result.tsx (M1.5). */
export function EntityImportResult({ result, onImportAnother, onClose }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm">
        {result.created} nieuw, {result.updated} bijgewerkt, {result.unchanged} ongewijzigd
        {result.deleted > 0 && `, ${result.deleted} verwijderd (vervangen)`}.
        {result.errors.length > 0 && ` ${result.errors.length} regel(s) overgeslagen.`}
      </p>
      {result.errors.length > 0 && (
        <ul className="text-sm text-muted-foreground space-y-0.5">
          {result.errors.map((e) => (
            <li key={e.line}>
              Regel {e.line}: {e.reason}
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onImportAnother}>
          Nog een bestand importeren
        </Button>
        <Button onClick={onClose}>Sluiten</Button>
      </div>
    </div>
  );
}
