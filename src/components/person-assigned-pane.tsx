import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatEUR, personLineCost } from "@/lib/pricing";
import { AssignmentHoursPopover } from "@/components/assignment-hours-popover";
import type { PeriodPerson } from "@/types";

interface Props {
  periodId: number;
  periodName: string;
  hasAnyPeople: boolean;
  assignedByRole: [string, PeriodPerson[]][];
  collapsed: Set<string>;
  onToggle: (role: string) => void;
  days: number;
  onRemove: (assignmentId: number) => void;
  invalidateKey: readonly unknown[];
}

function formatWindow(pp: PeriodPerson): string | null {
  if (!pp.startAt || !pp.endAt) return null;
  return `${format(new Date(pp.startAt), "HH:mm")}–${format(new Date(pp.endAt), "HH:mm")}`;
}

/** "In &lt;periode&gt;" (assigned) pane, extracted from
 * person-split-editor.tsx (Y3.3) — pure move, no behaviour change. */
export function PersonAssignedPane({
  periodId,
  periodName,
  hasAnyPeople,
  assignedByRole,
  collapsed,
  onToggle,
  days,
  onRemove,
  invalidateKey,
}: Props) {
  return (
    <section className="rounded-lg border border-border overflow-hidden md:rounded-none md:border-0 md:overflow-visible md:space-y-2">
      <div className="bg-muted/60 px-3 py-2.5 border-b border-border md:hidden">
        <h4 className="text-sm font-semibold">In &quot;{periodName}&quot;</h4>
      </div>
      <h4 className="hidden md:block text-xs font-semibold uppercase text-muted-foreground">In &quot;{periodName}&quot;</h4>
      <div className="hidden md:block h-9" aria-hidden />
      <div className="p-3 md:p-0">
      <ScrollArea className="h-[400px] pr-2">
        <div className="space-y-2">
          {assignedByRole.map(([role, items]) => {
            const isCollapsed = collapsed.has(role);
            return (
              <div key={role}>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground w-full hover:text-foreground"
                  onClick={() => onToggle(role)}
                >
                  {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span>{role}</span>
                  <span className="font-normal normal-case ml-1">({items.length})</span>
                </button>
                {!isCollapsed && (
                  <div className="space-y-1 mt-1 ml-4">
                    {items.map((pp) => (
                      <div key={pp.id} className="flex items-center gap-1.5 bg-muted/40 rounded px-2 py-1 text-xs">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => onRemove(pp.id)}
                          title="Verwijderen"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </Button>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{pp.person.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatEUR(personLineCost(pp, days))}
                            {formatWindow(pp) && ` · ${formatWindow(pp)}`}
                          </p>
                        </div>
                        <AssignmentHoursPopover
                          periodId={periodId}
                          assignmentId={pp.id}
                          startAt={pp.startAt}
                          endAt={pp.endAt}
                          invalidateKey={invalidateKey}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {!hasAnyPeople && (
            <p className="text-xs text-muted-foreground py-6 text-center">Nog geen personen in deze periode</p>
          )}
        </div>
      </ScrollArea>
      </div>
    </section>
  );
}
