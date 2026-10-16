import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ALL_STATUSES, OPEN_STATUSES, STATUS_LABELS, serializeStatusParam, toggleStatus,
  type ProjectStatusFilter,
} from "@/lib/project-filter";

function isPreset(status: ProjectStatusFilter, preset: ProjectStatusFilter): boolean {
  return serializeStatusParam(status) === serializeStatusParam(preset);
}

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  status: ProjectStatusFilter;
  onStatusChange: (s: ProjectStatusFilter) => void;
  hidden: number;
}

/** Search + status chips above the project list. Each status is its own
 * toggle (any combination); "Lopend" (concept, bevestigd, actief) is the
 * default preset and "Alles" shows everything. */
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
          {ALL_STATUSES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status.includes(s) ? "default" : "outline"}
              aria-pressed={status.includes(s)}
              onClick={() => onStatusChange(toggleStatus(status, s))}
            >
              {STATUS_LABELS[s]}
            </Button>
          ))}
          <span className="mx-1 w-px self-stretch bg-border" aria-hidden />
          <Button size="sm" variant={isPreset(status, OPEN_STATUSES) ? "secondary" : "ghost"} onClick={() => onStatusChange(OPEN_STATUSES)}>
            Lopend
          </Button>
          <Button size="sm" variant={isPreset(status, ALL_STATUSES) ? "secondary" : "ghost"} onClick={() => onStatusChange(ALL_STATUSES)}>
            Alles
          </Button>
        </div>
      </div>
      {hidden > 0 && (
        <p className="text-sm text-muted-foreground">
          {hidden} {hidden === 1 ? "project" : "projecten"} verborgen door het statusfilter.{" "}
          <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => onStatusChange(ALL_STATUSES)}>
            Toon alles
          </button>
        </p>
      )}
    </div>
  );
}
