import { ChevronDown, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MaterialGroupRow } from "@/components/material-group-row";
import { BundleBookingRow } from "@/components/bundle-booking-row";
import type { MaterialGroup } from "@/lib/grouping";
import type { PeriodBundleBooking } from "@/types";

interface Props {
  periodName: string;
  groupsByCategory: [string, MaterialGroup[]][];
  hasAnyBookings: boolean;
  collapsed: Set<string>;
  onToggle: (cat: string) => void;
  days: number;
  onRemoveOne: (assignmentId: number) => void;
  onRemoveAllInGroup: (group: MaterialGroup) => void;
  bundleBookings: PeriodBundleBooking[];
  onRemoveBundle: (bundleBookingId: number) => void;
}

/** "In &lt;periode&gt;" (assigned) pane, extracted from
 * material-split-editor.tsx (Y3.6) — pure move, no behaviour change. */
export function MaterialAssignedPane({
  periodName,
  groupsByCategory,
  hasAnyBookings,
  collapsed,
  onToggle,
  days,
  onRemoveOne,
  onRemoveAllInGroup,
  bundleBookings,
  onRemoveBundle,
}: Props) {
  return (
    <section className="rounded-lg border border-border overflow-hidden md:rounded-none md:border-0 md:overflow-visible md:space-y-2">
      <div className="bg-muted/60 px-3 py-2.5 border-b border-border md:hidden">
        <h4 className="text-sm font-semibold">In &quot;{periodName}&quot;</h4>
      </div>
      <h4 className="hidden md:block text-xs font-semibold uppercase text-muted-foreground">
        In &quot;{periodName}&quot;
      </h4>
      <div className="hidden md:block h-9" aria-hidden />
      <div className="p-3 md:p-0">
        <ScrollArea className="h-[400px] pr-2">
          <div className="space-y-2">
            {groupsByCategory.map(([cat, items]) => {
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
                      {items.map((g) => (
                        <MaterialGroupRow
                          key={g.key}
                          group={g}
                          days={days}
                          onRemoveOne={() =>
                            onRemoveOne(g.assignments[g.assignments.length - 1].id)
                          }
                          onRemoveAll={() => onRemoveAllInGroup(g)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {!hasAnyBookings && (
              <p className="text-xs text-muted-foreground py-6 text-center">
                Nog geen materialen in deze periode
              </p>
            )}
            {bundleBookings.map((b) => (
              <BundleBookingRow
                key={`bundle-${b.id}`}
                booking={b}
                days={days}
                onRemove={() => onRemoveBundle(b.id)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </section>
  );
}
