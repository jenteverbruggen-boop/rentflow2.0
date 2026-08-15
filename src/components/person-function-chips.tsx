"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EntityCombobox } from "@/components/entity-combobox";
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
}

/** Function chips on the person form (L1.3), extracted so
 * person-form.tsx stays under the 150-line limit. Each assigned
 * function shows an optional per-person day/hour rate override —
 * blank means "use the function's own default" (or Person.dayPrice if
 * the function has none), per effective-price.ts's resolution order. */
export function PersonFunctionChips({ functions, value, onChange, onCreateFunction }: Props) {
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
              <div key={v.functionId} className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate">{fn.name}</span>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder={fn.dayRate != null ? `${fn.dayRate}/dag` : "dagtarief"}
                  value={v.dayRate ?? ""}
                  onChange={(e) => setRate(v.functionId, "dayRate", e.target.value)}
                  className="h-8 w-24"
                />
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder={fn.hourRate != null ? `${fn.hourRate}/uur` : "uurtarief"}
                  value={v.hourRate ?? ""}
                  onChange={(e) => setRate(v.functionId, "hourRate", e.target.value)}
                  className="h-8 w-24"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-destructive hover:text-destructive"
                  onClick={() => toggle(v.functionId)}
                >
                  ×
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <EntityCombobox
        items={functions.filter((f) => !value.some((v) => v.functionId === f.id))}
        value={null}
        onChange={(id) => id && toggle(id)}
        onCreate={onCreateFunction}
        placeholder="Functie toevoegen..."
        createLabel="+ Nieuwe functie"
      />
    </div>
  );
}
