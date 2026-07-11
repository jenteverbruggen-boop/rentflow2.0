"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ClientForm } from "@/components/client-form";
import type { Client } from "@/types";

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json();
}

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["clients"], queryFn: () => get("/api/clients") });

  const upsert = useMutation({
    mutationFn: async (values: Partial<Client>) => {
      const url = editing ? `/api/clients/${editing.id}` : "/api/clients";
      const res = await fetch(url, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Mislukt");
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); setFormOpen(false); setEditing(null); },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verwijderen mislukt");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); setDeleting(null); },
    onError: (e) => setDeleteError(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Klanten</h2>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>+ Nieuwe klant</Button>
      </div>

      {clients.length === 0 ? (
        <p className="text-muted-foreground">Nog geen klanten.</p>
      ) : (
        <div className="grid gap-3">
          {clients.map((c) => (
            <Card key={c.id}>
              <CardContent className="py-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  {c.contactName && <p className="text-sm text-muted-foreground">{c.contactName}</p>}
                  {[c.email, c.phone].filter(Boolean).join(" · ") && (
                    <p className="text-xs text-muted-foreground mt-0.5">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
                  )}
                  {c._count && <Badge variant="secondary" className="mt-1 text-xs">{c._count.projects} project(en)</Badge>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(c); setFormOpen(true); }}>Bewerken</Button>
                  <Button size="sm" variant="destructive" onClick={() => { setDeleteError(null); setDeleting(c); }}>Verwijderen</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ClientForm open={formOpen} onOpenChange={setFormOpen} defaultValues={editing} onSubmit={(v) => upsert.mutate(v)} isPending={upsert.isPending} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Klant verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteError ? <span className="text-destructive">{deleteError}</span> : `"${deleting?.name}" definitief verwijderen?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            {!deleteError && <AlertDialogAction onClick={() => deleting && remove.mutate(deleting.id)}>Verwijderen</AlertDialogAction>}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
