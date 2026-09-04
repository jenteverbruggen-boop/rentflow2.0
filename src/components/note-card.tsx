"use client";

import { format } from "date-fns";
import { nl } from "date-fns/locale";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NoteImages } from "@/components/note-images";
import { NoteAuditLine } from "@/components/note-audit-line";
import { NoteAssignPopover } from "@/components/note-assign-popover";
import { useAuthMe } from "@/hooks/use-auth-me";
import type { Note } from "@/types";

interface Props {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
  /** Hide the link badge inside a project/client's own tab — the context
   * is already obvious there. */
  hideLinkBadge?: boolean;
}

export function NoteCard({ note, onEdit, onDelete, hideLinkBadge }: Props) {
  const unassigned = !note.project && !note.client;

  // scope: own may edit/add-photos only to a note they themselves wrote
  // (server-enforced in the note/image routes) and can never delete one
  // at all — hide the buttons that would just 403 rather than let them
  // click through to an error.
  const { data: me } = useAuthMe();
  const isOwnScope = me?.scope === "own";
  const isAuthor = !me || note.createdById === me.user.id;
  const canEdit = !isOwnScope || isAuthor;
  const canDelete = !isOwnScope;

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold truncate">{note.title}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(note.noteDate), "d MMM yyyy", { locale: nl })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && <Button size="sm" variant="ghost" onClick={() => onEdit(note)}>Bewerken</Button>}
            {canDelete && <Button size="sm" variant="ghost" onClick={() => onDelete(note)}>✕</Button>}
          </div>
        </div>

        <p className="text-sm whitespace-pre-wrap">{note.body}</p>

        <NoteImages noteId={note.id} images={note.images} editable={canEdit} />

        {!hideLinkBadge && (
          <div className="flex items-center gap-2">
            {note.project && (
              <Link href={`/projects/${note.project.id}`}>
                <Badge variant="secondary">📁 {note.project.name}</Badge>
              </Link>
            )}
            {note.client && <Badge variant="secondary">🏢 {note.client.name}</Badge>}
            {unassigned && (
              <>
                <Badge className="bg-amber-600 text-white">Niet toegewezen</Badge>
                <NoteAssignPopover note={note} />
              </>
            )}
          </div>
        )}

        <NoteAuditLine note={note} />
      </CardContent>
    </Card>
  );
}
