import Link from "next/link";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusVariant } from "@/lib/utils";
import type { Project } from "@/types";

/** K3.1 — extracted from page.tsx to make room for the new money
 * tiles without pushing the dashboard past the 150-line limit. Pure
 * move, no behaviour change. */
export function UpcomingProjectsCard({ projects }: { projects: Project[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Aankomende projecten</CardTitle>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <p className="text-muted-foreground text-sm">Geen aankomende projecten</p>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="flex items-center justify-between gap-3 hover:bg-accent px-3 py-2 rounded-lg transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[p.client, p.location].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {format(new Date(p.startDate), "d MMM", { locale: nl })}
                  </span>
                  <Badge className={statusVariant(p.status)}>{p.status}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
