"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { EntityImportPreviewTable } from "@/components/entity-import-preview-table";
import { EntityImportResult } from "@/components/entity-import-result";
import { useEntityImport } from "@/hooks/use-entity-import";
import { ENTITY_LABELS, type ImportEntity, type ImportMode, type ImportPreview, type ImportApplyResult } from "@/lib/import/pipeline-client-types";

// P3.3/§7.7 — Invoices are never listed, in either mode: a sent
// invoice's numbering/amounts are frozen, and an "upsert" import is
// indistinguishable from editing them (design doc §1.6).
const ENTITY_OPTIONS: { value: ImportEntity; label: string }[] = [
  { value: "materials", label: "Materialen" },
  { value: "people", label: "Personen" },
  { value: "clients", label: "Klanten" },
  { value: "locations", label: "Locaties" },
];

type Step = "setup" | "preview" | "done";

/** P3.4 — entity + mode selection, then the same upload → preview →
 * confirm flow as M1.5's materials-only dialog, generalised to all four
 * entities and both modes. Replace mode is visually distinct (red
 * border/badge) and gated behind a typed confirmation, never a bare OK
 * button (Q49b). */
export default function ImportPage() {
  const [entity, setEntity] = useState<ImportEntity>("materials");
  const [mode, setMode] = useState<ImportMode>("update");
  const [step, setStep] = useState<Step>("setup");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportApplyResult | null>(null);
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { preview: previewMutation, apply: applyMutation } = useEntityImport(entity);

  function reset() {
    setStep("setup");
    setFile(null);
    setPreview(null);
    setResult(null);
    setTypedConfirmation("");
    previewMutation.reset();
    applyMutation.reset();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setFile(picked);
    previewMutation.mutate(
      { file: picked, mode },
      { onSuccess: (data) => { setPreview(data); setStep("preview"); } },
    );
  }

  function handleConfirm() {
    if (!file) return;
    applyMutation.mutate(
      { file, mode, typedConfirmation: mode === "replace" ? typedConfirmation : undefined },
      { onSuccess: (data) => { setResult(data); setStep("done"); } },
    );
  }

  const expectedLabel = ENTITY_LABELS[entity];
  const hasBlockers = !!preview?.blockers?.length;
  const confirmationOk = mode === "update" || typedConfirmation.trim() === expectedLabel;
  const canConfirm =
    !!preview &&
    !hasBlockers &&
    confirmationOk &&
    (mode === "replace" || preview.totals.new > 0 || preview.totals.updated > 0);

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold">Importeren</h2>

      {step === "setup" && (
        <Card>
          <CardHeader>
            <CardTitle>Bestand kiezen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Type gegevens</p>
              <Select value={entity} onValueChange={(v) => setEntity(v as ImportEntity)}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Modus</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={mode === "update" ? "default" : "outline"}
                  onClick={() => setMode("update")}
                >
                  Bijwerken
                </Button>
                <Button
                  type="button"
                  variant={mode === "replace" ? "destructive" : "outline"}
                  onClick={() => setMode("replace")}
                >
                  ⚠️ Vervangen
                </Button>
              </div>
              {mode === "replace" && (
                <p className="text-xs text-destructive">
                  Vervangen verwijdert alle bestaande {expectedLabel} en laadt het bestand opnieuw. Alleen mogelijk zonder bestaande koppelingen (boekingen, projecten, ...).
                </p>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={handleFile}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={previewMutation.isPending}>
              {previewMutation.isPending ? "Bestand wordt gelezen…" : "Bestand kiezen"}
            </Button>
            {previewMutation.isError && (
              <Alert variant="destructive">
                <AlertDescription>{(previewMutation.error as Error).message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {step === "preview" && preview && (
        <Card className={mode === "replace" ? "border-destructive/50" : undefined}>
          <CardHeader>
            <CardTitle>{mode === "replace" ? "⚠️ Vervangen bevestigen" : "Voorbeeld"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EntityImportPreviewTable preview={preview} />

            {mode === "replace" && !hasBlockers && (
              <div className="space-y-1.5">
                <p className="text-sm">
                  Typ <span className="font-mono font-semibold">{expectedLabel}</span> om te bevestigen:
                </p>
                <Input
                  value={typedConfirmation}
                  onChange={(e) => setTypedConfirmation(e.target.value)}
                  placeholder={expectedLabel}
                  className="max-w-xs"
                />
              </div>
            )}

            {applyMutation.isError && (
              <Alert variant="destructive">
                <AlertDescription>{(applyMutation.error as Error).message}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={applyMutation.isPending}>
                Ander bestand
              </Button>
              <Button
                variant={mode === "replace" ? "destructive" : "default"}
                onClick={handleConfirm}
                disabled={!canConfirm || applyMutation.isPending}
              >
                {applyMutation.isPending ? "Bezig…" : mode === "replace" ? "Vervangen" : "Bevestigen"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && result && (
        <Card>
          <CardContent className="pt-6">
            <EntityImportResult result={result} onImportAnother={reset} onClose={reset} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
