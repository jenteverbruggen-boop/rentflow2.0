import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { PlanningProject } from "@/lib/planning-include";

interface Props {
  weekProjects: { project: PlanningProject; people: number; materials: number }[];
}

/** "Alle projecten deze week" list, extracted from planning/page.tsx (Y3.2)
 * — pure move, no behaviour change. */
export function PlanningWeekList({ weekProjects }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-muted-foreground">
          Alle projecten deze week
        </CardTitle>
      </CardHeader>
      <CardContent>
        {weekProjects.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Geen projecten deze week
          </p>
        ) : (
          <div className="space-y-0">
            {weekProjects.map(({ project: p, people, materials }, i) => (
              <div key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex justify-between items-center py-3 hover:bg-accent px-2 rounded-lg transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[p.client, p.location].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    <p>👥 {people} personen</p>
                    <p>📦 {materials} materialen</p>
                  </div>
                </Link>
                {i < weekProjects.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
