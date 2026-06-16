"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProjectOverviewTab } from "@/components/project-overview-tab";
import { ProjectPeriodsTab } from "@/components/project-periods-tab";
import { ProjectPersonsTab } from "@/components/project-persons-tab";
import { ProjectMaterialsTab } from "@/components/project-materials-tab";
import { ProjectCostsTab } from "@/components/project-costs-tab";
import { statusVariant } from "@/lib/utils";
import { formatEUR, projectTotal } from "@/lib/pricing";
import type { Project } from "@/types";

async function fetchProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`);
  if (!res.ok) throw new Error("Project niet gevonden");
  return res.json();
}

type TabKey = "overview" | "periods" | "persons" | "materials" | "costs";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as TabKey) ?? "overview";
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);

  function setTab(next: TabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`?${params.toString()}`);
  }

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject(id),
  });

  useEffect(() => {
    if (project && project.periods.length > 0 && selectedPeriodId == null) {
      setSelectedPeriodId(project.periods[0].id);
    }
  }, [project, selectedPeriodId]);

  if (isLoading) return <p className="text-muted-foreground">Laden...</p>;
  if (!project) return <p className="text-muted-foreground">Project niet gevonden</p>;

  const total = projectTotal(project.periods);

  function jumpToPeriod(periodId: number) {
    setSelectedPeriodId(periodId);
    setTab("periods");
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <Button variant="ghost" className="text-muted-foreground -ml-2" onClick={() => router.push("/projects")}>
          ← Terug
        </Button>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold">{project.name}</h2>
                <p className="text-muted-foreground text-sm mt-0.5">
                  {[project.client, project.location].filter(Boolean).join(" · ")}
                </p>
                <p className="text-muted-foreground text-sm">
                  {format(new Date(project.startDate), "d MMM yyyy", { locale: nl })} –{" "}
                  {format(new Date(project.endDate), "d MMM yyyy", { locale: nl })}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div>
                  <p className="text-xs text-muted-foreground">Totaal</p>
                  <p className="text-xl font-semibold tabular-nums">{formatEUR(total)}</p>
                </div>
                <Badge className={statusVariant(project.status)}>{project.status}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <div className="overflow-x-auto pb-1">
            <TabsList className="w-max">
              <TabsTrigger value="overview">Overzicht</TabsTrigger>
              <TabsTrigger value="periods">Periodes</TabsTrigger>
              <TabsTrigger value="persons">Personen</TabsTrigger>
              <TabsTrigger value="materials">Materialen</TabsTrigger>
              <TabsTrigger value="costs">Kosten</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="overview" className="mt-4">
            <ProjectOverviewTab project={project} onJumpToPeriod={jumpToPeriod} />
          </TabsContent>
          <TabsContent value="periods" className="mt-4">
            <ProjectPeriodsTab project={project} selectedPeriodId={selectedPeriodId} onSelectPeriod={setSelectedPeriodId} />
          </TabsContent>
          <TabsContent value="persons" className="mt-4">
            <ProjectPersonsTab project={project} selectedPeriodId={selectedPeriodId} onSelectPeriod={setSelectedPeriodId} />
          </TabsContent>
          <TabsContent value="materials" className="mt-4">
            <ProjectMaterialsTab project={project} selectedPeriodId={selectedPeriodId} onSelectPeriod={setSelectedPeriodId} />
          </TabsContent>
          <TabsContent value="costs" className="mt-4">
            <ProjectCostsTab project={project} />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
