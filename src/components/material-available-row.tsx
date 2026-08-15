import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatEUR } from "@/lib/pricing";
import type { MaterialAvailability } from "@/types";

interface Props {
  item: MaterialAvailability;
  qty: number;
  onQtyChange: (qty: number) => void;
  onAdd: () => void;
  addPending: boolean;
}

/** One row in the "Beschikbaar" pane, extracted from
 * material-available-pane.tsx (Y3.6, split further to stay ≤150 lines) —
 * pure move, no behaviour change. */
export function MaterialAvailableRow({
  item: m,
  qty,
  onQtyChange,
  onAdd,
  addPending,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 bg-muted/30 rounded px-2 py-1.5 text-xs">
      <div className="flex-1 min-w-[120px]">
        <p className="font-medium truncate flex items-center gap-1">
          {m.material.name}
          {m.material.isBundle && (
            <Badge variant="secondary" className="text-[9px] h-3.5 px-1">
              set
            </Badge>
          )}
        </p>
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
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {!m.material.isBundle && (
          <Input
            type="number"
            min={1}
            max={m.availableCount}
            value={qty}
            onChange={(e) => onQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-12 h-7 text-xs"
          />
        )}
        <Button
          size="icon"
          className="h-7 w-7"
          disabled={addPending || qty > m.availableCount}
          onClick={onAdd}
          title="Toevoegen aan periode"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
