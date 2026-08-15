import { ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatEUR } from "@/lib/pricing";
import type { PersonAvailability } from "@/types";

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  byRole: [string, PersonAvailability[]][];
  collapsed: Set<string>;
  onToggle: (role: string) => void;
  onAdd: (args: { personId: number; role?: string }) => void;
  addPending: boolean;
}

/** "Beschikbaar" pane, extracted from person-split-editor.tsx (Y3.3) — pure
 * move, no behaviour change. */
export function PersonAvailablePane({
  search,
  onSearchChange,
  byRole,
  collapsed,
  onToggle,
  onAdd,
  addPending,
}: Props) {
  return (
    <section className="rounded-lg border border-border overflow-hidden md:rounded-none md:border-0 md:overflow-visible md:space-y-2">
      <div className="bg-muted/60 px-3 py-2.5 border-b border-border md:hidden">
        <h4 className="text-sm font-semibold">Beschikbaar</h4>
      </div>
      <h4 className="hidden md:block text-xs font-semibold uppercase text-muted-foreground">Beschikbaar</h4>
      <div className="p-3 space-y-2 md:p-0">
      <Input placeholder="Zoeken op naam of functie..." value={search} onChange={(e) => onSearchChange(e.target.value)} />
      <ScrollArea className="h-[400px] pr-2">
        <div className="space-y-2">
          {byRole.map(([role, items]) => {
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
                    {items.map((p) => (
                      <div key={p.person.id} className="flex items-center gap-1.5 bg-muted/30 rounded px-2 py-1 text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{p.person.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {p.isAvailable ? "Beschikbaar" : `Bezet (${p.blockingProject?.name})`} · {formatEUR(p.person.dayPrice)}/d
                          </p>
                        </div>
                        <Button
                          size="icon"
                          className="h-7 w-7"
                          disabled={!p.isAvailable || addPending}
                          onClick={() => onAdd({ personId: p.person.id, role: p.person.role ?? undefined })}
                          title="Toevoegen aan periode"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {byRole.length === 0 && (
            <p className="text-xs text-muted-foreground py-6 text-center">Geen personen beschikbaar</p>
          )}
        </div>
      </ScrollArea>
      </div>
    </section>
  );
}
