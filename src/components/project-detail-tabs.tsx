import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProjectOverviewTab } from "@/components/project-overview-tab";
import { ProjectPeriodsTab } from "@/components/project-periods-tab";
import { ProjectPersonsTab } from "@/components/project-persons-tab";
import { ProjectMaterialsTab } from "@/components/project-materials-tab";
import { ProjectCostsTab } from "@/components/project-costs-tab";
import type { Project } from "@/types";

export type TabKey = "overview" | "periods" | "persons" | "materials" | "costs";

interface Props {
  project: Project;
  tab: TabKey;
  setTab: (next: TabKey) => void;
  selectedPeriodId: number | null;
  onSelectPeriod: (periodId: number) => void;
  jumpToPeriod: (periodId: number) => void;
}

/** The <Tabs> assembly, extracted from projects/[id]/page.tsx (Y3.4) — pure
 * move, no behaviour change. */
export function ProjectDetailTabs({
  project,
  tab,
  setTab,
  selectedPeriodId,
  onSelectPeriod,
  jumpToPeriod,
}: Props) {
  return (
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
        <ProjectPeriodsTab
          project={project}
          selectedPeriodId={selectedPeriodId}
          onSelectPeriod={onSelectPeriod}
        />
      </TabsContent>
      <TabsContent value="persons" className="mt-4">
        <ProjectPersonsTab
          project={project}
          selectedPeriodId={selectedPeriodId}
          onSelectPeriod={onSelectPeriod}
        />
      </TabsContent>
      <TabsContent value="materials" className="mt-4">
        <ProjectMaterialsTab
          project={project}
          selectedPeriodId={selectedPeriodId}
          onSelectPeriod={onSelectPeriod}
        />
      </TabsContent>
      <TabsContent value="costs" className="mt-4">
        <ProjectCostsTab project={project} />
      </TabsContent>
    </Tabs>
  );
}
