"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityCombobox } from "@/components/entity-combobox";
import { useAuthMe } from "@/hooks/use-auth-me";
import type { Project, Client } from "@/types";

type Kind = "none" | "project" | "client";

interface Props {
  projectId: number | null;
  clientId: number | null;
  onChange: (next: { projectId: number | null; clientId: number | null }) => void;
}

function deriveKind(projectId: number | null, clientId: number | null): Kind {
  if (projectId != null) return "project";
  if (clientId != null) return "client";
  return "none";
}

/** Lets a note be linked to a project, a client, or neither — the
 * create/edit form's "koppelen aan" control. Note-form-dialog remounts
 * this fresh each time it opens (Radix unmounts DialogContent on close),
 * so initializing `kind` once from props is safe: picking "Project" in
 * the dropdown before choosing a specific one doesn't get reverted by a
 * prop-derived resync, which a naive `projectId != null` derivation
 * would cause. */
export function NoteLinkPicker({ projectId, clientId, onChange }: Props) {
  const [kind, setKind] = useState<Kind>(() => deriveKind(projectId, clientId));
  // scope: own has no client-catalogue access at all (GET /api/clients
  // is a flat 403 for them) and can only ever link a note to a project
  // they're booked on — hide the option entirely rather than offer a
  // combobox that would come back empty.
  const { data: me } = useAuthMe();
  const isOwnScope = me?.scope === "own";

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json()),
  });
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: () => fetch("/api/clients").then((r) => (r.ok ? r.json() : [])),
    enabled: !isOwnScope,
  });

  function selectKind(next: Kind) {
    setKind(next);
    onChange({ projectId: null, clientId: null });
  }

  // The `useAuthMe` query resolves after mount, so a fresh (no
  // defaultValues) picker briefly starts at "none" for everyone,
  // scope: own included, before we know their scope — correct it the
  // moment we find out. Harmless to re-run: once kind is "project" the
  // condition is false and this becomes a no-op.
  useEffect(() => {
    if (isOwnScope && kind === "none") selectKind("project");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwnScope]);

  return (
    <div className="flex gap-2">
      <Select value={kind} onValueChange={(v) => selectKind(v as Kind)}>
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {!isOwnScope && <SelectItem value="none">Niet toegewezen</SelectItem>}
          <SelectItem value="project">Project</SelectItem>
          {!isOwnScope && <SelectItem value="client">Klant</SelectItem>}
        </SelectContent>
      </Select>

      {kind === "project" && (
        <div className="flex-1">
          <EntityCombobox
            items={projects.map((p) => ({ id: p.id, name: p.name }))}
            value={projectId}
            onChange={(id) => onChange({ projectId: id, clientId: null })}
            placeholder="Kies een project..."
          />
        </div>
      )}
      {kind === "client" && !isOwnScope && (
        <div className="flex-1">
          <EntityCombobox
            items={clients.map((c) => ({ id: c.id, name: c.name }))}
            value={clientId}
            onChange={(id) => onChange({ projectId: null, clientId: id })}
            placeholder="Kies een klant..."
          />
        </div>
      )}
    </div>
  );
}
