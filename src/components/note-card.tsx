"use client";

import { format } from "date-fns";
import { nl } from "date-fns/locale";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NoteThumbnailStrip } from "@/components/note-thumbnail-strip";
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
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{note.title}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(note.noteDate), "d MMM yyyy", { locale: nl })}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canEdit && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(note)} title="Bewerken">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 hover:text-destructive"
                onClick={() => onDelete(note)}
                title="Verwijderen"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2">{note.body}</p>

        <NoteThumbnailStrip images={note.images} />

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {!hideLinkBadge ? (
            <div className="flex flex-wrap items-center gap-2">
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
          ) : (
            <span />
          )}
          <NoteAuditLine note={note} />
        </div>
      </CardContent>
    </Card>
  );
}
