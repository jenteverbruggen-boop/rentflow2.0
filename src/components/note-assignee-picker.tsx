"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAssignablePeople } from "@/hooks/use-note-assignees";

interface Props {
  value: number[];
  onChange: (ids: number[]) => void;
}

/** Pick any number of persons for a note: a scrollable checklist, since a
 * crew is a handful to a few dozen names. */
export function NoteAssigneePicker({ value, onChange }: Props) {
  const { data: people = [], isLoading } = useAssignablePeople(true);
  const toggle = (id: number, on: boolean) =>
    onChange(on ? [...value, id] : value.filter((v) => v !== id));

  if (isLoading) return <p className="text-xs text-muted-foreground">Personen laden...</p>;
  if (people.length === 0) return <p className="text-xs text-muted-foreground">Geen personen beschikbaar.</p>;

  return (
    <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-md border p-2">
      {people.map((p) => (
        <div key={p.id} className="flex items-center gap-2">
          <Checkbox id={`assignee-${p.id}`} checked={value.includes(p.id)} onCheckedChange={(v) => toggle(p.id, v === true)} />
          <Label htmlFor={`assignee-${p.id}`} className="font-normal">{p.name}</Label>
        </div>
      ))}
    </div>
  );
}
