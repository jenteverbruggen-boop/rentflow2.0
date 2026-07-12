"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { PersonDocument } from "@/types";

interface Props {
  personId: number;
}

function expiryBadge(expiresAt: string | null) {
  if (!expiresAt) return null;
  const days = differenceInDays(new Date(expiresAt), new Date());
  if (days < 0) return <Badge variant="destructive">Verlopen</Badge>;
  if (days < 30) return <Badge className="bg-amber-600 text-white">Verloopt binnenkort</Badge>;
  return null;
}

export function PersonDocuments({ personId }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [deleting, setDeleting] = useState<PersonDocument | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: docs = [] } = useQuery<PersonDocument[]>({
    queryKey: ["person-docs", personId],
    queryFn: () => fetch(`/api/people/${personId}/documents`).then((r) => r.json()),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      if (label) fd.append("label", label);
      if (expiresAt) fd.append("expiresAt", expiresAt);
      const res = await fetch(`/api/people/${personId}/documents`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload mislukt");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["person-docs", personId] }); setLabel(""); setExpiresAt(""); setUploadError(null); },
    onError: (e) => setUploadError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => fetch(`/api/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["person-docs", personId] }); setDeleting(null); },
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload.mutate(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Documenten</p>

      <div className="flex gap-2 flex-wrap items-end">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Label (optioneel)</p>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="bv. Rijbewijs B" className="h-8 text-sm w-40" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Vervaldatum (optioneel)</p>
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-8 text-sm w-36" />
        </div>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? "Uploaden..." : "Attest uploaden"}
        </Button>
        <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
      </div>

      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}

      {docs.length === 0 ? (
        <p className="text-xs text-muted-foreground">Geen documenten</p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{doc.label ?? doc.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {(doc.sizeBytes / 1024).toFixed(0)} KB · {format(new Date(doc.createdAt), "d MMM yyyy", { locale: nl })}
                  {doc.expiresAt && ` · t/m ${format(new Date(doc.expiresAt), "d MMM yyyy", { locale: nl })}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {expiryBadge(doc.expiresAt)}
                <a href={`/api/documents/${doc.id}`} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline">Download</Button>
                </a>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(doc)}>✕</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Document verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>&quot;{deleting?.label ?? deleting?.filename}&quot; definitief verwijderen?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove.mutate(deleting.id)}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
