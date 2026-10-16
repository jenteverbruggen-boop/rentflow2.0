"use client";

import Link from "next/link";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthMe } from "@/hooks/use-auth-me";
import { useNotes } from "@/hooks/use-notes";
import { useToggleMyDone } from "@/hooks/use-note-assignees";
import { Button } from "@/components/ui/button";
import { hasAccess } from "@/lib/me-access";

const MAX_SHOWN = 5;

/** C4 — the notes assigned to me that I haven't ticked off yet. Needs a
 * linked person (that's who notes are assigned to) and notes access, so the
 * card simply isn't there for an admin without a person or a role without
 * notes. Quiet when nothing is open. */
export function AssignedNotesCard() {
  const { data: me } = useAuthMe();
  const enabled = me?.personId != null && hasAccess(me, "notities");
  const { data: notes = [] } = useNotes({ assignedToMe: true, open: true }, enabled);
  const toggle = useToggleMyDone();
  if (!enabled || notes.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Aan mij toegewezen ({notes.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {notes.slice(0, MAX_SHOWN).map((n) => (
          <div key={n.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-accent">
            <Link href="/notes" className="min-w-0">
              <p className="truncate text-sm font-medium">{n.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[n.project?.name ?? n.client?.name, format(new Date(n.noteDate), "d MMM", { locale: nl })].filter(Boolean).join(" · ")}
              </p>
            </Link>
            <Button size="sm" variant="outline" className="h-7 shrink-0" disabled={toggle.isPending} onClick={() => toggle.mutate({ noteId: n.id, done: true })}>
              Afvinken
            </Button>
          </div>
        ))}
        {notes.length > MAX_SHOWN && (
          <Link href="/notes" className="block px-3 pt-1 text-xs text-muted-foreground underline underline-offset-2">
            Alle {notes.length} bekijken
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
