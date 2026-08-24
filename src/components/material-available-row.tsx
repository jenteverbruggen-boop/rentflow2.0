import { ArrowRight } from "lucide-react";
import { QuantityInput } from "@/components/quantity-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatEUR } from "@/lib/pricing";
import type { MaterialAvailability } from "@/types";

interface Props {
  item: MaterialAvailability;
  qty: number;
  onQtyChange: (qty: number) => void;
  onAdd: (allowOverbook: boolean) => void;
  addPending: boolean;
  /** Overboeken — true on a concept/geannuleerd project, where the stock
   * ceiling is lifted so an offer can quote units that must still be
   * bought. Elsewhere the old clamp stands. */
  overbookable: boolean;
}

/** One row in the "Beschikbaar" pane, extracted from
 * material-available-pane.tsx (Y3.6, split further to stay ≤150 lines). */
export function MaterialAvailableRow({
  item: m,
  qty,
  onQtyChange,
  onAdd,
  addPending,
  overbookable,
}: Props) {
  const over = Math.max(0, qty - m.availableCount);
  const isOverbooking = overbookable && over > 0;
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 bg-muted/30 rounded px-2 py-1.5 text-xs">
      <div className="flex-1 min-w-[120px]">
        <div className="font-medium truncate flex items-center gap-1">
          {m.material.name}
          {m.material.isBundle && (
            <Badge variant="secondary" className="text-[9px] h-3.5 px-1">
              set
            </Badge>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground truncate">
          {m.availableCount}{" "}
          {m.material.isBundle ? "set(s) vrij" : `/${m.totalStock} vrij`} ·{" "}
          {formatEUR(m.material.dayPrice)}/d
        </p>
        {m.material.isBundle && m.sharedComponents && m.sharedComponents.length > 0 && (
          <p className="text-[10px] text-muted-foreground truncate">
            🔗 deelt voorraad: {m.sharedComponents.join(", ")}
          </p>
        )}
        {isOverbooking && (
          <p className="text-[10px] text-amber-600 dark:text-amber-500 truncate">
            ⚠ {over} {m.material.isBundle ? "set(s)" : "unit(s)"} overboekt —
            niet in voorraad
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {!m.material.isBundle && (
          <QuantityInput
            min={1}
            {...(overbookable ? {} : { max: m.availableCount })}
            value={qty}
            onChange={(e) => onQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
            className="h-7 text-xs"
            aria-label={`Aantal ${m.material.name}`}
          />
        )}
        <Button
          size="icon"
          className="h-7 w-7"
          disabled={addPending || (!overbookable && qty > m.availableCount)}
          onClick={() => onAdd(isOverbooking)}
          title={isOverbooking ? "Overboeken en toevoegen" : "Toevoegen aan periode"}
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
