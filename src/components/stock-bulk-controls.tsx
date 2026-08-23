"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { pickHighestRemovable, type BulkUnit } from "@/lib/stock-bulk";
import { useStockBulk, StockBulkError } from "@/hooks/use-stock-bulk";
import type { StockItem } from "@/types";

interface Props {
  materialId: number;
  units: StockItem[];
}

/** "Aantal units" bulk add/remove block — [-] [count] [+] pre-filled
 * with the current unit count, client-side pre-flight (reusing the
 * exact same pickHighestRemovable() the server enforces, so the two
 * never disagree), and the inline success/409 result. */
export function StockBulkControls({ materialId, units }: Props) {
  const current = units.length;
  const [target, setTarget] = useState(current);
  const { bulkAdd, bulkRemove } = useStockBulk(materialId);

  useEffect(() => setTarget(current), [current]);

  const bulkUnits: BulkUnit[] = units.map((u) => ({
    id: u.id,
    unitNumber: u.unitNumber,
    bookingCount: u.assignments?.length ?? 0,
  }));

  const delta = target - current;
  const removing = delta < 0;
  const preflight = removing ? pickHighestRemovable(bulkUnits, -delta) : null;
  const blocked = preflight?.blockedUnits ?? [];
  const canApply = delta !== 0 && blocked.length === 0;
  const applying = bulkAdd.isPending || bulkRemove.isPending;
  const lastError = (bulkAdd.error ?? bulkRemove.error) as StockBulkError | null;
  const addResult = bulkAdd.data;
  const removeResult = bulkRemove.data;

  function apply() {
    bulkAdd.reset();
    bulkRemove.reset();
    if (delta > 0) bulkAdd.mutate(delta);
    else if (delta < 0) bulkRemove.mutate({ count: -delta });
  }

  return (
    <div className="space-y-2 mb-4 rounded-md border border-border p-3">
      <p className="text-sm font-semibold">Aantal units</p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setTarget((t) => Math.max(0, t - 1))}>
          −
        </Button>
        <Input
          type="number"
          min={0}
          max={500}
          value={target}
          onChange={(e) => setTarget(Math.max(0, parseInt(e.target.value, 10) || 0))}
          className="w-20 text-center"
        />
        <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setTarget((t) => t + 1)}>
          +
        </Button>
        <Button type="button" size="sm" className="ml-auto" disabled={!canApply || applying} onClick={apply}>
          {applying ? "Bezig..." : "Toepassen"}
        </Button>
      </div>
      {delta !== 0 && (
        <p className="text-xs text-muted-foreground">
          Huidig: {current} → {Math.abs(delta)} units {removing ? "verwijderen" : "toevoegen"}
        </p>
      )}
      {removing && blocked.length > 0 && preflight && (
        <Alert variant="destructive">
          <AlertDescription className="space-y-2">
            <p>
              {-delta} units verwijderen kan niet — {blocked.length} unit(s) in die reeks{" "}
              {blocked.length === 1 ? "is" : "zijn"} nog geboekt (#{blocked.join(", #")}).
              {preflight.removableFromTop > 0
                ? ` Maximaal ${preflight.removableFromTop} unit(s) kunnen nu verwijderd worden, vanaf de hoogste.`
                : " Los die boekingen eerst op."}
            </p>
            {/* Targets removableFromTop, never removable: a booked unit
                below the top caps what a highest-first removal accepts,
                so offering the material-wide free count would just
                reproduce this same error. */}
            {preflight.removableFromTop > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setTarget(current - preflight.removableFromTop)}
              >
                Verwijder {preflight.removableFromTop}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      {lastError && !(removing && blocked.length > 0) && (
        <Alert variant="destructive">
          <AlertDescription>{lastError.message}</AlertDescription>
        </Alert>
      )}
      {addResult && (
        <p className="text-xs text-muted-foreground">
          {addResult.added} unit(s) toegevoegd (#{addResult.fromUnit}–#{addResult.toUnit})
        </p>
      )}
      {removeResult && (
        <p className="text-xs text-muted-foreground">
          {removeResult.removed} unit(s) verwijderd (#{removeResult.removedUnits.join(", #")})
        </p>
      )}
    </div>
  );
}
