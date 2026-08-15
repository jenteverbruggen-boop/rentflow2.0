import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import type { Material } from "@/types";

interface Props {
  material: Material;
  onToggleBundle: () => void;
  onManageUnits: () => void;
}

/** Title + "Markeer als set"/"Beheer units" buttons, extracted from
 * material-detail-pane.tsx (Y3.5) — pure move, no behaviour change. */
export function MaterialDetailHeader({
  material,
  onToggleBundle,
  onManageUnits,
}: Props) {
  return (
    <CardHeader className="pb-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <CardTitle>
            {material.isBundle && "🎁 "}
            {material.name}
          </CardTitle>
          {material.isBundle && (
            <span className="text-xs text-muted-foreground">Set / bundel</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={material.isBundle ? "default" : "outline"}
            onClick={onToggleBundle}
          >
            {material.isBundle ? "🎁 Set" : "Markeer als set"}
          </Button>
          {!material.isBundle && (
            <Button size="sm" variant="outline" onClick={onManageUnits}>
              Beheer units
            </Button>
          )}
        </div>
      </div>
    </CardHeader>
  );
}
