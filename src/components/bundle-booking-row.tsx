import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatEUR } from "@/lib/pricing";
import type { PeriodBundleBooking } from "@/types";

interface Props {
  booking: PeriodBundleBooking;
  days: number;
  onRemove: () => void;
}

/** One assigned bundle-booking row, extracted from
 * material-assigned-pane.tsx (Y3.6, split further to stay ≤150 lines) —
 * pure move, no behaviour change. */
export function BundleBookingRow({ booking: b, days, onRemove }: Props) {
  return (
    <div className="flex items-center gap-1.5 bg-blue-950/30 rounded px-2 py-1 text-xs border border-blue-800/30">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate flex items-center gap-1">
          {b.material?.name ?? "Bundle"}
          <Badge variant="secondary" className="text-[9px] h-3.5 px-1">
            set ×{b.quantity}
          </Badge>
        </p>
        <p className="text-[10px] text-muted-foreground">
          {formatEUR(b.dayPriceSnapshot)}/d · {formatEUR(b.dayPriceSnapshot * days)} totaal
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
