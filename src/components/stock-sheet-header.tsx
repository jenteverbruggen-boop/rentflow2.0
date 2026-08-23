import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatEUR } from "@/lib/pricing";
import type { Material } from "@/types";

interface Props {
  material: Material;
  onEdit: () => void;
  onDelete: () => void;
}

/** Material summary (name/category/dayPrice/notes) + Bewerken/Verwijderen,
 * extracted from stock-items-sheet.tsx to keep that file under the
 * 150-line limit — pure move, no behaviour change. */
export function StockSheetHeader({ material, onEdit, onDelete }: Props) {
  return (
    <>
      <SheetHeader className="mb-4">
        <SheetTitle>{material.name}</SheetTitle>
      </SheetHeader>

      <div className="space-y-1 text-sm mb-3">
        {material.category && <Badge variant="secondary">{material.category}</Badge>}
        <p className="text-muted-foreground">
          Dagprijs: <span className="font-medium text-foreground">{formatEUR(material.dayPrice)}</span>
        </p>
        {material.notes && <p className="text-muted-foreground">{material.notes}</p>}
      </div>

      <div className="flex gap-2 mb-4">
        <Button size="sm" variant="outline" onClick={onEdit}>
          ✏️ Bewerken
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            if (confirm(`Materiaal "${material.name}" verwijderen?`)) onDelete();
          }}
        >
          🗑️ Verwijderen
        </Button>
      </div>

      <Separator className="mb-4" />
    </>
  );
}
