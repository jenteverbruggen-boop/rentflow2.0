"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PersonDocuments } from "@/components/person-documents";
import { PersonCalendarFeed } from "@/components/person-calendar-feed";
import type { Person } from "@/types";

interface Props {
  person: Person;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

// Extracted from page.tsx when the expanded card grew a second section
// (documents plus the agenda feed) and pushed the page past 150 lines.
export function PersonCard({ person, expanded, onToggle, onEdit, onDelete }: Props) {
  return (
    <Card className="cursor-pointer" onClick={onToggle}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-medium">{person.name}</p>
            {person.functions && person.functions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {person.functions.map((f) => (
                  <Badge key={f.functionId} variant="secondary" className="text-xs">
                    {f.function?.name}
                  </Badge>
                ))}
              </div>
            )}
            {person.email && (
              <p className="text-xs text-muted-foreground mt-0.5">{person.email}</p>
            )}
          </div>
          <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              ✏️
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete}>
              🗑️
            </Button>
          </div>
        </div>
        {expanded && (
          <div onClick={(e) => e.stopPropagation()}>
            <Separator className="my-2" />
            <div className="space-y-4">
              <PersonDocuments personId={person.id} />
              <PersonCalendarFeed personId={person.id} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
