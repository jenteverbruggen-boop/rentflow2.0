import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ApplyMaterialImportResult } from "@/lib/import/apply-material-import";

interface Props {
  result: ApplyMaterialImportResult;
  onImportAnother: () => void;
  onClose: () => void;
}

/** M1.5 — the final step's summary + error list, extracted to keep the
 * dialog itself under the file's line budget. */
export function MaterialImportResult({ result, onImportAnother, onClose }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm">
        {result.created} nieuw, {result.updated} bijgewerkt, {result.unchanged} ongewijzigd.
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
      <DialogFooter>
        <Button variant="outline" onClick={onImportAnother}>
          Nog een bestand importeren
        </Button>
        <Button onClick={onClose}>Sluiten</Button>
      </DialogFooter>
    </div>
  );
}
