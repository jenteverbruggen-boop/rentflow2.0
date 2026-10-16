"use client";

import { Check, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthMe } from "@/hooks/use-auth-me";
import { useToggleMyDone } from "@/hooks/use-note-assignees";
import type { Note } from "@/types";

/** Who a note is for, with a tick per person and "2/3 afgewerkt". If the
 * viewer is one of the assignees they get a button for their own part. */
export function NoteAssignees({ note }: { note: Note }) {
  const { data: me } = useAuthMe();
  const toggle = useToggleMyDone();
  if (note.assignees.length === 0) return null;

  const done = note.assignees.filter((a) => a.doneAt).length;
  const mine = me?.personId == null ? undefined : note.assignees.find((a) => a.personId === me.personId);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {note.assignees.map((a) => (
        <Badge key={a.personId} variant={a.doneAt ? "secondary" : "outline"} className={a.doneAt ? "text-muted-foreground line-through" : ""}>
          {a.doneAt ? <Check className="mr-1 h-3 w-3" aria-hidden /> : <Circle className="mr-1 h-3 w-3" aria-hidden />}
          {a.personName}
        </Badge>
      ))}
      <span className="text-xs text-muted-foreground">{done}/{note.assignees.length} afgewerkt</span>
      {mine && (
        <Button
          size="sm"
          variant={mine.doneAt ? "ghost" : "outline"}
          className="h-6 px-2 text-xs"
          disabled={toggle.isPending}
          onClick={() => toggle.mutate({ noteId: note.id, done: !mine.doneAt })}
        >
          {mine.doneAt ? "Heropenen" : "Afvinken"}
        </Button>
      )}
    </div>
  );
}
