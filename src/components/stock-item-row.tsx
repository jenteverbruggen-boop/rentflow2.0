"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { StockItem } from "@/types";

interface Props {
  item: StockItem;
  selected: boolean;
  onToggleSelect: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** One unit row inside the units sheet, with a selection checkbox that
 * locks itself out (🔒 + tooltip) once the unit has ever been booked —
 * mirrors the server's own "any PeriodStockItem row, ever" rule so the
 * UI never offers a selection the bulk-delete route would reject. */
export function StockItemRow({ item, selected, onToggleSelect, onEdit, onDelete }: Props) {
  const booked = (item.assignments?.length ?? 0) > 0;

  return (
    <div className="flex items-start gap-2 bg-muted/40 rounded-md px-3 py-2 text-sm">
      <div className="pt-0.5 shrink-0">
        {booked ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Checkbox checked={false} disabled aria-label={`Unit #${item.unitNumber} is geboekt en kan niet geselecteerd worden`} />
              </span>
            </TooltipTrigger>
            <TooltipContent>🔒 Geboekt — kan niet verwijderd worden</TooltipContent>
          </Tooltip>
        ) : (
          <Checkbox
            checked={selected}
            onCheckedChange={(c) => onToggleSelect(c === true)}
            aria-label={`Unit #${item.unitNumber} selecteren`}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium">
          #{item.unitNumber} {item.identifier ? `· ${item.identifier}` : ""} {booked && "🔒"}
        </p>
        {item.notes && <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>}
        {!item.identifier && !item.notes && <p className="text-xs text-muted-foreground">—</p>}
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onEdit}>
        ✏️
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 hover:text-destructive" onClick={onDelete}>
        🗑️
      </Button>
    </div>
  );
}
