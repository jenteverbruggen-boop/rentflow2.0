"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { PeriodTimelinePicker } from "@/components/period-timeline-picker";
import { PersonSplitEditor } from "@/components/person-split-editor";
import type { Project } from "@/types";

interface Props {
  project: Project;
  selectedPeriodId: number | null;
  onSelectPeriod: (id: number) => void;
}

export function ProjectPersonsTab({ project, selectedPeriodId, onSelectPeriod }: Props) {
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const selectedPeriod = project.periods.find((p) => p.id === selectedPeriodId) ?? null;

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      )}
      {warnings.length > 0 && (
        <Alert>
          <AlertDescription className="text-amber-600">
            {warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
          </AlertDescription>
        </Alert>
      )}

      <PeriodTimelinePicker
        project={project}
        selectedPeriodId={selectedPeriodId}
        onSelectPeriod={onSelectPeriod}
      />

      {selectedPeriod ? (
        <PersonSplitEditor
          period={selectedPeriod}
          project={project}
          onWarnings={setWarnings}
          onError={setError}
        />
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Klik op een periode in de timeline hierboven om personen toe te voegen.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
