import { ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MaterialAvailableRow } from "@/components/material-available-row";
import type { MaterialAvailability } from "@/types";

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  byCategory: [string, MaterialAvailability[]][];
  collapsed: Set<string>;
  onToggle: (cat: string) => void;
  qtyMap: Record<number, number>;
  onQtyChange: (materialId: number, qty: number) => void;
  onAdd: (args: { materialId: number; quantity: number }) => void;
  addPending: boolean;
}

/** "Beschikbaar" pane, extracted from material-split-editor.tsx (Y3.6) —
 * pure move, no behaviour change. */
export function MaterialAvailablePane({
  search,
  onSearchChange,
  byCategory,
  collapsed,
  onToggle,
  qtyMap,
  onQtyChange,
  onAdd,
  addPending,
}: Props) {
  return (
    <section className="rounded-lg border border-border overflow-hidden md:rounded-none md:border-0 md:overflow-visible md:space-y-2">
      <div className="bg-muted/60 px-3 py-2.5 border-b border-border md:hidden">
        <h4 className="text-sm font-semibold">Beschikbaar</h4>
      </div>
      <h4 className="hidden md:block text-xs font-semibold uppercase text-muted-foreground">
        Beschikbaar
      </h4>
      <div className="p-3 space-y-2 md:p-0">
        <Input
          placeholder="Zoeken op naam of categorie..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <ScrollArea className="h-[400px] pr-2">
          <div className="space-y-2">
            {byCategory.map(([cat, items]) => {
              const isCollapsed = collapsed.has(cat);
              return (
                <div key={cat}>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground w-full hover:text-foreground"
                    onClick={() => onToggle(cat)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                    <span>{cat}</span>
                    <span className="font-normal normal-case ml-1">
                      ({items.length})
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-1 mt-1 ml-4">
                      {items.map((m) => (
                        <MaterialAvailableRow
                          key={m.material.id}
                          item={m}
                          qty={qtyMap[m.material.id] ?? 1}
                          onQtyChange={(qty) => onQtyChange(m.material.id, qty)}
                          onAdd={() =>
                            onAdd({
                              materialId: m.material.id,
                              quantity: m.material.isBundle
                                ? 1
                                : (qtyMap[m.material.id] ?? 1),
                            })
                          }
                          addPending={addPending}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {byCategory.length === 0 && (
              <p className="text-xs text-muted-foreground py-6 text-center">
                Geen materialen gevonden
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
    </section>
  );
}
