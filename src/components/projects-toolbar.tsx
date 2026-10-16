import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectStatusFilter } from "@/lib/project-filter";

const OPTIONS: { value: ProjectStatusFilter; label: string }[] = [
  { value: "open", label: "Lopend" },
  { value: "afgerond", label: "Afgerond" },
  { value: "geannuleerd", label: "Geannuleerd" },
  { value: "all", label: "Alles" },
];

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  status: ProjectStatusFilter;
  onStatusChange: (s: ProjectStatusFilter) => void;
  hidden: number;
}

/** Search + status chips above the project list. "Lopend" (concept,
 * bevestigd, actief) is the default; finished work is one click away. */
export function ProjectsToolbar({ query, onQueryChange, status, onStatusChange, hidden }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Zoek op naam, klant, locatie, notitie…"
            aria-label="Projecten zoeken"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
          {OPTIONS.map((o) => (
            <Button
              key={o.value}
              size="sm"
              variant={status === o.value ? "default" : "outline"}
              aria-pressed={status === o.value}
              onClick={() => onStatusChange(o.value)}
            >
              {o.label}
            </Button>
          ))}
        </div>
      </div>
      {hidden > 0 && (
        <p className="text-sm text-muted-foreground">
          {hidden} {hidden === 1 ? "project" : "projecten"} verborgen door het statusfilter.{" "}
          <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => onStatusChange("all")}>
            Toon alles
          </button>
        </p>
      )}
    </div>
  );
}
