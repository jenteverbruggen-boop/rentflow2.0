"use client";

import { Button } from "@/components/ui/button";
import type { StockItem } from "@/types";

interface Props {
  units: StockItem[];
  selectedIds: number[];
  onSelectAllFree: () => void;
  onClear: () => void;
  onRemoveSelection: () => void;
  isPending: boolean;
}

/** "alles" select-all (free units only) + "Verwijder selectie (n)",
 * extracted so stock-items-sheet.tsx stays under the 150-line limit. */
export function StockSelectionBar({
  units,
  selectedIds,
  onSelectAllFree,
  onClear,
  onRemoveSelection,
  isPending,
}: Props) {
  const freeCount = units.filter((u) => (u.assignments?.length ?? 0) === 0).length;
  const allFreeSelected = freeCount > 0 && selectedIds.length === freeCount;

  if (units.length === 0) return null;

  return (
    <div className="flex items-center gap-3 mb-2 text-xs">
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto p-0"
        onClick={allFreeSelected ? onClear : onSelectAllFree}
      >
        {allFreeSelected ? "geen" : "alles"}
      </Button>
      {selectedIds.length > 0 && (
        <Button type="button" variant="destructive" size="sm" className="h-7 ml-auto" disabled={isPending} onClick={onRemoveSelection}>
          🗑️ Verwijder selectie ({selectedIds.length})
        </Button>
      )}
    </div>
  );
}
