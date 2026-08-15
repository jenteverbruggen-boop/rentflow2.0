"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProjectDetailHeader } from "@/components/project-detail-header";
import { ProjectDetailTabs, type TabKey } from "@/components/project-detail-tabs";
import type { Project } from "@/types";

async function fetchProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`);
  if (!res.ok) throw new Error("Project niet gevonden");
  return res.json();
}

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
  if (!project)
    return <p className="text-muted-foreground">Project niet gevonden</p>;

  function jumpToPeriod(periodId: number) {
    setSelectedPeriodId(periodId);
    setTab("periods");
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <ProjectDetailHeader project={project} />
        <ProjectDetailTabs
          project={project}
          tab={tab}
          setTab={setTab}
          selectedPeriodId={selectedPeriodId}
          onSelectPeriod={setSelectedPeriodId}
          jumpToPeriod={jumpToPeriod}
        />
      </div>
    </TooltipProvider>
  );
}
