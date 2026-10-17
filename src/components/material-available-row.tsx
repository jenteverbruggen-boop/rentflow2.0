import { ArrowRight, Link2, TriangleAlert } from "lucide-react";
import { InlineIcon } from "@/components/inline-icon";
import { QuantityInput } from "@/components/quantity-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatEUR } from "@/lib/pricing";
import { noSellingPrice } from "@/lib/price-warnings";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useState } from "react";
import type { MaterialAvailability } from "@/types";
import { basisSuffix } from "@/lib/price-basis";

const OPEN = "__open__";

interface Props {
  item: MaterialAvailability;
  qty: number;
  onQtyChange: (qty: number) => void;
  /** `subhireSupplierId`: hire the units beyond stock in from this supplier. */
  onAdd: (allowOverbook: boolean, subhireSupplierId?: number) => void;
  addPending: boolean;
  /** Active suppliers (empty = the caller can't hire in). */
  suppliers: { id: number; name: string }[];
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
  suppliers,
  overbookable,
}: Props) {
  const [supplier, setSupplier] = useState(OPEN);
  const over = Math.max(0, qty - m.availableCount);
  // An inhuur-only item is always hired in (server-side, from its default
  // supplier); any other can be, by naming a supplier — also in a confirmed
  // project, where hiring in is the only way past the stock ceiling.
  const alwaysHired = !!m.material.subhireOnly && !m.material.isBundle;
  const canHire = suppliers.length > 0;
  const hiring = over > 0 && !alwaysHired && supplier !== OPEN;
  const liftedCeiling = overbookable || alwaysHired || canHire;
  const isOverbooking = overbookable && over > 0 && !hiring && !alwaysHired;
  const needsSupplier = !overbookable && !alwaysHired && over > 0 && !hiring;
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
          {formatEUR(m.material.dayPrice)}{basisSuffix(m.material.priceBasis)}
        </p>
        {noSellingPrice(m.material) && (
          <p className="text-[10px] text-amber-700 dark:text-amber-500 truncate">
            <InlineIcon icon={TriangleAlert} /> geen verkoopprijs — wordt aan €0 gefactureerd
          </p>
        )}
        {m.material.isBundle && m.sharedComponents && m.sharedComponents.length > 0 && (
          <p className="text-[10px] text-muted-foreground truncate">
            <InlineIcon icon={Link2} /> deelt voorraad: {m.sharedComponents.join(", ")}
          </p>
        )}
        {alwaysHired && over > 0 && (
          <p className="text-[10px] text-muted-foreground truncate">{over} unit(s) worden ingehuurd (enkel-inhuur materiaal)</p>
        )}
        {canHire && over > 0 && !alwaysHired && (
          <Select value={supplier} onValueChange={setSupplier}>
            <SelectTrigger className="mt-1 h-6 text-[10px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={OPEN}>{overbookable ? `${over} overboeken (open laten)` : `${over} te weinig — kies leverancier`}</SelectItem>
              {suppliers.map((s) => <SelectItem key={s.id} value={String(s.id)}>{over} inhuren bij {s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {isOverbooking && (
          <p className="text-[10px] text-amber-600 dark:text-amber-500 truncate">
            <InlineIcon icon={TriangleAlert} /> {over} {m.material.isBundle ? "set(s)" : "unit(s)"} overboekt —
            niet in voorraad
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {!m.material.isBundle && (
          <QuantityInput
            min={1}
            {...(liftedCeiling ? {} : { max: m.availableCount })}
            value={qty}
            onChange={(e) => onQtyChange(Math.max(1, parseInt(e.target.value) || 1))}
            className="h-7 text-xs"
            aria-label={`Aantal ${m.material.name}`}
          />
        )}
        <Button
          size="icon"
          className="h-7 w-7"
          disabled={addPending || (!liftedCeiling && qty > m.availableCount) || (canHire && needsSupplier)}
          onClick={() => onAdd(isOverbooking, hiring ? Number(supplier) : undefined)}
          title={hiring ? "Inhuren en toevoegen" : isOverbooking ? "Overboeken en toevoegen" : "Toevoegen aan periode"}
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
