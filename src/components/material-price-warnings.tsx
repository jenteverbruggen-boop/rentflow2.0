import { TriangleAlert } from "lucide-react";
import { InlineIcon } from "@/components/inline-icon";
import { noSellingPrice, sellAtOrBelowCost } from "@/lib/price-warnings";
import type { Material } from "@/types";

/** Amber hints on the material detail pane: no selling price yet (bookings
 * would bill €0), or an inhuur-only item sold at/below its purchase price. */
export function MaterialPriceWarnings({ material }: { material: Material }) {
  const none = noSellingPrice(material);
  const loss = sellAtOrBelowCost(material);
  if (!none && !loss) return null;
  return (
    <p className="text-xs text-amber-700 dark:text-amber-500">
      <InlineIcon icon={TriangleAlert} />{" "}
      {none ? "Geen verkoopprijs — nieuwe boekingen worden aan €0 gefactureerd." : "Verkoop ≤ inkoop — met deze prijs maak je verlies."}
    </p>
  );
}
