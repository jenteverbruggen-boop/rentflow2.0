import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusSelect } from "@/components/status-select";
import { ProjectEditButton } from "@/components/project-edit-button";
import { formatEUR, projectTotal } from "@/lib/pricing";
import type { Project } from "@/types";

interface Props {
  project: Project;
}

/** Back button, action links and the summary card, extracted from
 * projects/[id]/page.tsx (Y3.4) — pure move, no behaviour change. */
export function ProjectDetailHeader({ project }: Props) {
  const router = useRouter();
  const total = projectTotal(project.periods);

  return (
    <>
      <Button
        variant="ghost"
        className="text-muted-foreground -ml-2"
        onClick={() => router.push("/projects")}
      >
        ← Terug
      </Button>

      <div className="flex flex-wrap gap-2 justify-end no-print">
        <ProjectEditButton project={project} />
        <Link href={`/projects/${project.id}/pakbon`}>
          <Button variant="outline" size="sm">
            Pakbon afdrukken
          </Button>
        </Link>
        <Link href={`/projects/${project.id}/callsheet`}>
          <Button variant="outline" size="sm">
            Callsheet afdrukken
          </Button>
        </Link>
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
            <div className="flex items-center gap-3 shrink-0">
              <div>
                <p className="text-xs text-muted-foreground">Totaal</p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatEUR(total)}
                </p>
              </div>
              <StatusSelect project={project} />
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
