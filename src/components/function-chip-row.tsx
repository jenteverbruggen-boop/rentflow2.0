"use client";

import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Function as Fn } from "@/types";
import type { FunctionAssignment } from "@/components/person-function-chips";

interface Props {
  fn: Fn;
  assignment: FunctionAssignment;
  onRateChange: (field: "dayRate" | "hourRate", raw: string) => void;
  onEdit: () => void;
  onRemove: () => void;
}

/** One assigned-function row on the person form, extracted out of
 * PersonFunctionChips to keep it under the 150-line limit. The two
 * inputs are the per-person rate *override* (blank = inherit the
 * function's own company-default, shown as placeholder); the pencil
 * button opens FunctionFormDialog for the company default itself
 * (person-form.tsx renders it as a sibling dialog, not nested — see
 * that file's comment on why). An archived function can still be
 * assigned here (it just can't be picked again once removed), marked
 * so the distinction from an active one is visible. */
export function FunctionChipRow({ fn, assignment, onRateChange, onEdit, onRemove }: Props) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate">{fn.name}</span>
        {fn.archived && (
          <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
            Gearchiveerd
          </Badge>
        )}
      </span>
      <Input
        type="number"
        step="0.01"
        min={0}
        placeholder={fn.dayRate != null ? `${fn.dayRate}/dag` : "dagtarief"}
        value={assignment.dayRate ?? ""}
        onChange={(e) => onRateChange("dayRate", e.target.value)}
        className="h-8 w-24"
      />
      <Input
        type="number"
        step="0.01"
        min={0}
        placeholder={fn.hourRate != null ? `${fn.hourRate}/uur` : "uurtarief"}
        value={assignment.hourRate ?? ""}
        onChange={(e) => onRateChange("hourRate", e.target.value)}
        className="h-8 w-24"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        title="Functie bewerken (naam en standaardtarief)"
        onClick={onEdit}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-destructive hover:text-destructive"
        onClick={onRemove}
      >
        ×
      </Button>
    </div>
  );
}
