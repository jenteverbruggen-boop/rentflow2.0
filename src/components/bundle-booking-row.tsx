import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OverbookBadge } from "@/components/overbook-badge";
import { formatEUR } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { PeriodBundleBooking } from "@/types";

interface Props {
  booking: PeriodBundleBooking;
  days: number;
  onRemove: () => void;
  /** Overboeken — true when this booking's own components fell short of
   * stock, so the set is booked but not fully covered. */
  overbooked: boolean;
}

/** One assigned bundle-booking row, extracted from
 * material-assigned-pane.tsx (Y3.6, split further to stay ≤150 lines) —
 * pure move, no behaviour change. */
export function BundleBookingRow({ booking: b, days, onRemove, overbooked }: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded px-2 py-1 text-xs",
        overbooked
          ? "bg-amber-500/10 border border-amber-500/40"
          : "bg-blue-950/30 border border-blue-800/30",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate flex items-center gap-1">
          {b.material?.name ?? "Bundle"}
          <Badge variant="secondary" className="text-[9px] h-3.5 px-1">
            set ×{b.quantity}
          </Badge>
          {overbooked && <OverbookBadge />}
        </div>
        <p className="text-[10px] text-muted-foreground">
          {formatEUR(b.dayPriceSnapshot)}/d ·{" "}
          {formatEUR(b.dayPriceSnapshot == null ? null : b.dayPriceSnapshot * days)} totaal
        </p>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 hover:text-destructive"
        onClick={onRemove}
        title="Set verwijderen"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
