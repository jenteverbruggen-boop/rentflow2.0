"use client";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OverbookBlockDialog } from "@/components/overbook-block-dialog";
import { useProjectStatusMutation } from "@/hooks/use-project-status-mutation";
import { statusVariant } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/types";

const STATUSES: ProjectStatus[] = [
  "concept",
  "bevestigd",
  "actief",
  "afgerond",
  "geannuleerd",
];

interface StatusSelectProps {
  project: Project;
}

export function StatusSelect({ project }: StatusSelectProps) {
  const { mutation, blocked, dismissBlocked, error, dismissError } =
    useProjectStatusMutation(project);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Badge className={statusVariant(project.status)}>
              {project.status}
            </Badge>
            <span className="text-muted-foreground text-xs">▾</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {STATUSES.map((s) => (
            <DropdownMenuItem
              key={s}
              onSelect={() => mutation.mutate(s)}
              className="cursor-pointer"
            >
              <Badge className={statusVariant(s)}>{s}</Badge>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Both paths go through one dialog — a non-overbook failure used to
          be swallowed entirely, with the badge just snapping back. */}
      <OverbookBlockDialog
        shortages={blocked}
        message={error || undefined}
        onClose={() => {
          dismissBlocked();
          dismissError();
        }}
      />
    </>
  );
}
