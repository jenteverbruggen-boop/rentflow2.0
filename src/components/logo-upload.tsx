"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function LogoUpload() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>("/api/settings/logo");
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch("/api/settings/logo", { method: "PUT", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload mislukt");
    },
    onSuccess: () => { setError(null); queryClient.invalidateQueries({ queryKey: ["settings"] }); },
    onError: (e) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: () => fetch("/api/settings/logo", { method: "DELETE" }),
    onSuccess: () => { setPreviewUrl(null); queryClient.invalidateQueries({ queryKey: ["settings"] }); },
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    upload.mutate(file);
  }

  return (
    <Card>
      <CardHeader><CardTitle>Logo</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Bedrijfslogo"
            className="max-h-24 max-w-48 object-contain border border-border rounded"
            onError={() => setPreviewUrl(null)}
          />
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
            {upload.isPending ? "Uploaden..." : "Logo uploaden"}
          </Button>
          {previewUrl && (
            <Button type="button" variant="ghost" size="sm" onClick={() => remove.mutate()}>Verwijderen</Button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFile} />
      </CardContent>
    </Card>
  );
}
