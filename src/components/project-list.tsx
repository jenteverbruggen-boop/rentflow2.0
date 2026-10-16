import Link from "next/link";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatEUR, projectTotal } from "@/lib/pricing";
import { isOpenStatus } from "@/lib/project-filter";
import { statusVariant } from "@/lib/utils";
import type { Project } from "@/types";

interface Props {
  projects: Project[];
  onEdit: (p: Project) => void;
  onDelete: (p: Project) => void;
}

const byStart = (a: Project, b: Project) =>
  new Date(a.startDate).getTime() - new Date(b.startDate).getTime();

/** Open work first (soonest start on top), finished/cancelled after it
 * (most recent first). Open = concept, bevestigd, actief. */
function splitProjects(projects: Project[]) {
  return [
    { title: "Lopend en aankomend", items: projects.filter((p) => isOpenStatus(p.status)).sort(byStart) },
    { title: "Afgerond en geannuleerd", items: projects.filter((p) => !isOpenStatus(p.status)).sort((a, b) => byStart(b, a)) },
  ].filter((s) => s.items.length > 0);
}

export function ProjectList({ projects, onEdit, onDelete }: Props) {
  return (
    <div className="space-y-6">
      {splitProjects(projects).map(({ title, items }) => (
        <section key={title} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title} <span className="font-normal">({items.length})</span>
          </h3>
          {items.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-2 py-4">
                <Link href={`/projects/${p.id}`} className="min-w-0 basis-full sm:basis-0 sm:flex-1 hover:opacity-80">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {[p.client, p.location].filter(Boolean).join(" · ")}
                    {" · "}
                    {format(new Date(p.startDate), "d MMM", { locale: nl })} – {format(new Date(p.endDate), "d MMM yyyy", { locale: nl })}
                  </p>
                </Link>
                <span className="mr-auto sm:mr-0 sm:w-28 sm:text-right text-sm tabular-nums text-muted-foreground">
                  {formatEUR(projectTotal(p.periods))}
                </span>
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  <Badge className={`${statusVariant(p.status)} w-24 justify-center`}>{p.status}</Badge>
                  <Button variant="ghost" size="icon" aria-label="Project bewerken" onClick={() => onEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Project verwijderen" className="hover:text-destructive" onClick={() => onDelete(p)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      ))}
    </div>
  );
}
