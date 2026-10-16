import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ChevronDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusSelect } from "@/components/status-select";
import { ProjectEditButton } from "@/components/project-edit-button";
import { OverbookBadge } from "@/components/overbook-badge";
import { formatEUR, projectTotal } from "@/lib/pricing";
import { projectShortageLines } from "@/lib/project-shortages";
import type { Project } from "@/types";

const PRINT_DOCS = [
  { slug: "pakbon", label: "Pakbon" },
  { slug: "callsheet", label: "Callsheet" },
  { slug: "kosten", label: "Kostenoverzicht" },
];

interface Props {
  project: Project;
}

/** Back button, action links and the summary card, extracted from
 * projects/[id]/page.tsx (Y3.4) — pure move, no behaviour change. */
export function ProjectDetailHeader({ project }: Props) {
  const router = useRouter();
  const total = projectTotal(project.periods);
  // Overboeken — visible from every tab, not just Materialen.
  const overbooked = projectShortageLines(project).reduce(
    (sum, l) => sum + l.quantity,
    0,
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <Button
          variant="ghost"
          className="text-muted-foreground -ml-2"
          onClick={() => router.push("/projects")}
        >
          <ArrowLeft className="h-4 w-4" /> Terug
        </Button>
        <div className="flex flex-wrap gap-2">
          <ProjectEditButton project={project} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Printer className="h-4 w-4" /> Afdrukken <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {PRINT_DOCS.map(({ slug, label }) => (
                <DropdownMenuItem key={slug} asChild>
                  <Link href={`/projects/${project.id}/${slug}`}>{label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold">{project.name}</h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                {[project.client, project.location].filter(Boolean).join(" · ")}
              </p>
              <p className="text-muted-foreground text-sm">
                {format(new Date(project.startDate), "d MMM yyyy", {
                  locale: nl,
                })}{" "}
                –{" "}
                {format(new Date(project.endDate), "d MMM yyyy", {
                  locale: nl,
                })}
              </p>
            </div>
            <div className="shrink-0">
              <p className="text-xs text-muted-foreground">Totaal</p>
              <div className="flex items-center gap-3">
                <p className="text-xl font-semibold tabular-nums">
                  {formatEUR(total)}
                </p>
                {overbooked > 0 && <OverbookBadge units={overbooked} />}
                <StatusSelect project={project} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
