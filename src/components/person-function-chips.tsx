"use client";

import { EntityCombobox } from "@/components/entity-combobox";
import { FunctionChipRow } from "@/components/function-chip-row";
import type { Function as Fn } from "@/types";

export interface FunctionAssignment {
  functionId: number;
  dayRate?: number | null;
  hourRate?: number | null;
}

interface Props {
  functions: Fn[];
  value: FunctionAssignment[];
  onChange: (next: FunctionAssignment[]) => void;
  onCreateFunction: (name: string) => Promise<{ id: number }>;
  onEditFunction: (fn: Fn) => void;
}

/** Function chips on the person form (L1.3), extracted so
 * person-form.tsx stays under the 150-line limit. Each assigned
 * function shows an optional per-person day/hour rate override —
 * blank means "use the function's own default" (or Person.dayPrice if
 * the function has none), per effective-price.ts's resolution order.
 * The pencil on each row (function-chip-row.tsx) edits that company
 * default itself, via a dialog person-form.tsx renders as a sibling.
 * `functions` includes archived rows (so an already-assigned archived
 * function still resolves here) — only the add-picker below excludes
 * them, since an archived function must not be assignable again. */
export function PersonFunctionChips({ functions, value, onChange, onCreateFunction, onEditFunction }: Props) {
  function toggle(functionId: number) {
    const exists = value.some((v) => v.functionId === functionId);
    onChange(
      exists
        ? value.filter((v) => v.functionId !== functionId)
        : [...value, { functionId, dayRate: null, hourRate: null }],
    );
  }

  function setRate(functionId: number, field: "dayRate" | "hourRate", raw: string) {
    const parsed = raw === "" ? null : Number(raw);
    onChange(
      value.map((v) => (v.functionId === functionId ? { ...v, [field]: parsed } : v)),
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Functies</p>
      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((v) => {
            const fn = functions.find((f) => f.id === v.functionId);
            if (!fn) return null;
            return (
              <FunctionChipRow
                key={v.functionId}
                fn={fn}
                assignment={v}
                onRateChange={(field, raw) => setRate(v.functionId, field, raw)}
                onEdit={() => onEditFunction(fn)}
                onRemove={() => toggle(v.functionId)}
              />
            );
          })}
        </div>
      )}
      <EntityCombobox
        items={functions.filter((f) => !f.archived && !value.some((v) => v.functionId === f.id))}
        value={null}
        onChange={(id) => id && toggle(id)}
        onCreate={onCreateFunction}
        placeholder="Functie toevoegen..."
        createLabel="+ Nieuwe functie"
      />
    </div>
  );
}
