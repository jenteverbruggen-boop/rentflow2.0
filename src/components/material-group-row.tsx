import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OverbookBadge } from "@/components/overbook-badge";
import { formatEUR, lineCost } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { MaterialGroup } from "@/lib/grouping";

interface Props {
  group: MaterialGroup;
  days: number;
  onRemoveOne: () => void;
  onRemoveAll: () => void;
}

/** One assigned material-group row, extracted from
 * material-assigned-pane.tsx (Y3.6, split further to stay ≤150 lines). */
export function MaterialGroupRow({ group: g, days, onRemoveOne, onRemoveAll }: Props) {
  const perUnit = lineCost(g.dayPriceSnapshot, days, g);
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded px-2 py-1 text-xs",
        g.overbookedUnits > 0
          ? "bg-amber-500/10 border border-amber-500/40"
          : "bg-muted/40",
      )}
    >
      <Button
        size="icon"
        variant="outline"
        className="h-7 w-7"
        onClick={onRemoveOne}
        title={
          g.overbookedUnits > 0
            ? "Eén overboekte unit verwijderen"
            : "Eén unit verwijderen"
        }
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </Button>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate flex items-center gap-1.5">
          <span className="truncate">
            {g.material.name} <span className="text-muted-foreground">×{g.units}</span>
          </span>
          {g.overbookedUnits > 0 && (
            <OverbookBadge units={g.overbookedUnits} materialName={g.material.name} />
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          {g.units} × {formatEUR(perUnit)} = {formatEUR(perUnit * g.units)}
        </p>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className={cn("h-7 w-7 hover:text-destructive", g.units < 2 && "invisible")}
        onClick={onRemoveAll}
        title="Alle units verwijderen"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
