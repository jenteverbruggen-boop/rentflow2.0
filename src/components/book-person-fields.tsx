import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatEUR } from "@/lib/pricing";
import type { PersonFunction } from "@/types";

const SOURCE_LABELS: Record<string, string> = {
  project: "projectafspraak",
  client: "klanttarief",
  "person-function": "persoonlijk tarief",
  function: "functietarief",
  person: "standaardtarief",
  none: "geen tarief",
};

export interface BlockingProject {
  id: number;
  name: string;
  from: string;
  to: string;
}

interface Props {
  personName: string | undefined;
  fns: PersonFunction[];
  functionId: number | null;
  onFunctionChange: (id: number) => void;
  preview: { dayPriceSnapshot: number | null; source: string } | undefined;
  conflict: BlockingProject | null;
  error: string;
}

/** The body of BookPersonDialog (L2.2/L3.2/H2.1), extracted so the
 * dialog's own file has room for its mutation logic under the
 * 150-line limit. Pure presentation — all state lives in the parent. */
export function BookPersonFields({ personName, fns, functionId, onFunctionChange, preview, conflict, error }: Props) {
  return (
    <>
      {fns.length > 1 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Functie</Label>
          <Select
            value={functionId != null ? String(functionId) : undefined}
            onValueChange={(v) => onFunctionChange(Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Kies een functie..." />
            </SelectTrigger>
            <SelectContent>
              {fns.map((f) => (
                <SelectItem key={f.functionId} value={String(f.functionId)}>
                  {f.function?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {fns.length === 1 && (
        <p className="text-sm text-muted-foreground">Functie: {fns[0].function?.name}</p>
      )}
      {preview && (
        <p className="text-sm">
          Tarief: {preview.dayPriceSnapshot != null ? formatEUR(preview.dayPriceSnapshot) : "—"}
          <span className="text-xs text-muted-foreground"> ({SOURCE_LABELS[preview.source] ?? preview.source})</span>
        </p>
      )}
      {conflict && (
        <p className="text-xs text-destructive">
          {personName} staat al ingepland op &quot;{conflict.name}&quot;,{" "}
          {format(new Date(conflict.from), "d MMM HH:mm")}–{format(new Date(conflict.to), "HH:mm")}.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </>
  );
}
