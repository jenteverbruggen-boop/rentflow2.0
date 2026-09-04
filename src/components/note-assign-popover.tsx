"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { NoteLinkPicker } from "@/components/note-link-picker";
import { useNoteMutations } from "@/hooks/use-notes";
import type { Note } from "@/types";

/** One-click "→ Toewijzen" for a note that has no project/client yet —
 * the general notes view's shortcut so filing a note doesn't need the
 * full edit dialog. */
export function NoteAssignPopover({ note }: { note: Note }) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [clientId, setClientId] = useState<number | null>(null);
  const { update } = useNoteMutations();

  function save() {
    update.mutate(
      { id: note.id, values: { projectId, clientId } },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">→ Toewijzen</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <NoteLinkPicker
          projectId={projectId}
          clientId={clientId}
          onChange={({ projectId: p, clientId: c }) => { setProjectId(p); setClientId(c); }}
        />
        <Button size="sm" className="w-full" onClick={save} disabled={update.isPending || (!projectId && !clientId)}>
          {update.isPending ? "Bezig..." : "Toewijzen"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
