"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MaterialImportPreviewTable } from "@/components/material-import-preview-table";
import { MaterialImportResult } from "@/components/material-import-result";
import { useMaterialImport } from "@/hooks/use-material-import";
import type { ImportPreview } from "@/lib/import/material-preview";
import type { ApplyMaterialImportResult } from "@/lib/import/apply-material-import";

type Step = "upload" | "preview" | "done";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * M1.5 — upload → preview → confirm. There is deliberately no
 * direct-apply shortcut: `apply` only ever fires from the preview step,
 * after the user has seen exactly what will change (M1.2/M1.4's own
 * design intent).
 */
export function MaterialImportDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ApplyMaterialImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { preview: previewMutation, apply: applyMutation } = useMaterialImport();

  function reset() {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
    previewMutation.reset();
    applyMutation.reset();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setFile(picked);
    previewMutation.mutate(picked, {
      onSuccess: (data) => {
        setPreview(data);
        setStep("preview");
      },
    });
  }

  function handleConfirm() {
    if (!file) return;
    applyMutation.mutate(file, {
      onSuccess: (data) => {
        setResult(data);
        setStep("done");
      },
    });
  }

  const canConfirm =
    !!preview && (preview.totals.new > 0 || preview.totals.updated > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Materialen importeren</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload een Rentman-materiaalexport of een RentFlow-export (.csv of .xlsx).
            </p>
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
          </div>
        )}

        {step === "preview" && preview && (
          <div className="space-y-4">
            <MaterialImportPreviewTable preview={preview} />
            {applyMutation.isError && (
              <Alert variant="destructive">
                <AlertDescription>{(applyMutation.error as Error).message}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={reset} disabled={applyMutation.isPending}>
                Ander bestand
              </Button>
              <Button onClick={handleConfirm} disabled={!canConfirm || applyMutation.isPending}>
                {applyMutation.isPending ? "Bezig…" : "Bevestigen"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && result && (
          <MaterialImportResult
            result={result}
            onImportAnother={reset}
            onClose={() => {
              reset();
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
