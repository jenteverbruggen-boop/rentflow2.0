"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityCombobox } from "@/components/entity-combobox";
import { useAuthMe } from "@/hooks/use-auth-me";
import type { NoteListFilter } from "@/hooks/use-notes";
import type { Project, Client } from "@/types";

interface Props {
  filter: NoteListFilter;
  onChange: (next: NoteListFilter) => void;
}

/** Alle / Niet toegewezen / filter op project of klant, plus zoeken —
 * the general notes view's filter row. Project and client filters are
 * mutually exclusive (picking one clears the other). */
export function NoteFilterBar({ filter, onChange }: Props) {
  // scope: own only ever has project-linked notes of their own (see
  // lib/notes.ts's listNotes) — "Niet toegewezen" and a client filter
  // have nothing to show them, and GET /api/clients is a flat 403 for
  // them besides.
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

  const mode: "all" | "unassigned" | "linked" =
    filter.unassigned ? "unassigned" : filter.projectId != null || filter.clientId != null ? "linked" : "all";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant={mode === "all" ? "default" : "outline"} onClick={() => onChange({ q: filter.q })}>
        Alle
      </Button>
      {!isOwnScope && (
        <Button
          size="sm"
          variant={mode === "unassigned" ? "default" : "outline"}
          onClick={() => onChange({ q: filter.q, unassigned: true })}
        >
          Niet toegewezen
        </Button>
      )}
      <div className="w-48">
        <EntityCombobox
          items={projects.map((p) => ({ id: p.id, name: p.name }))}
          value={filter.projectId ?? null}
          onChange={(id) => onChange({ q: filter.q, projectId: id ?? undefined })}
          placeholder="Filter op project..."
        />
      </div>
      {!isOwnScope && (
        <div className="w-48">
          <EntityCombobox
            items={clients.map((c) => ({ id: c.id, name: c.name }))}
            value={filter.clientId ?? null}
            onChange={(id) => onChange({ q: filter.q, clientId: id ?? undefined })}
            placeholder="Filter op klant..."
          />
        </div>
      )}
      <Input
        placeholder="Zoeken in titel of inhoud..."
        value={filter.q ?? ""}
        onChange={(e) => onChange({ ...filter, q: e.target.value || undefined })}
        className="w-56"
      />
    </div>
  );
}
