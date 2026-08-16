"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ClientForm } from "@/components/client-form";
import { ClientList } from "@/components/client-list";
import { ClientDeleteDialog } from "@/components/client-delete-dialog";
import { ClientRatesDialog } from "@/components/client-rates-dialog";
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
  const [ratesFor, setRatesFor] = useState<Client | null>(null);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: () => get("/api/clients"),
  });

  const upsert = useMutation({
    mutationFn: async (values: Partial<Client>) => {
      const url = editing ? `/api/clients/${editing.id}` : "/api/clients";
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Mislukt");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setFormOpen(false);
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verwijderen mislukt");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setDeleting(null);
    },
    onError: (e) => setDeleteError(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Klanten</h2>
        <div className="flex gap-2">
          <a href="/api/clients/export" target="_blank" rel="noreferrer">
            <Button variant="outline">⬇️ Exporteren</Button>
          </a>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            + Nieuwe klant
          </Button>
        </div>
      </div>

      <ClientList
        clients={clients}
        onRates={setRatesFor}
        onEdit={(c) => { setEditing(c); setFormOpen(true); }}
        onDelete={(c) => { setDeleteError(null); setDeleting(c); }}
      />

      <ClientForm
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultValues={editing}
        onSubmit={(v) => upsert.mutate(v)}
        isPending={upsert.isPending}
      />

      <ClientDeleteDialog
        target={deleting}
        error={deleteError}
        onConfirm={(c) => remove.mutate(c.id)}
        onClose={() => setDeleting(null)}
      />

      <ClientRatesDialog client={ratesFor} onClose={() => setRatesFor(null)} />
    </div>
  );
}
