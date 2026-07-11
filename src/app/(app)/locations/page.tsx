"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LocationForm } from "@/components/location-form";
import type { Location } from "@/types";

export default function LocationsPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [deleting, setDeleting] = useState<Location | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: () => fetch("/api/locations").then((r) => r.json()),
  });

  const upsert = useMutation({
    mutationFn: async (values: Partial<Location>) => {
      const url = editing ? `/api/locations/${editing.id}` : "/api/locations";
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
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      setFormOpen(false);
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/locations/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verwijderen mislukt");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      setDeleting(null);
    },
    onError: (e) => setDeleteError(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Locaties</h2>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          + Nieuwe locatie
        </Button>
      </div>

      {locations.length === 0 ? (
        <p className="text-muted-foreground">Nog geen locaties.</p>
      ) : (
        <div className="grid gap-3">
          {locations.map((l) => (
            <Card key={l.id}>
              <CardContent className="py-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{l.name}</p>
                  {[l.address, [l.postalCode, l.city].filter(Boolean).join(" ")]
                    .filter(Boolean)
                    .join(", ") && (
                    <p className="text-sm text-muted-foreground">
                      {[
                        l.address,
                        [l.postalCode, l.city].filter(Boolean).join(" "),
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                  {l.phone && (
                    <p className="text-xs text-muted-foreground">{l.phone}</p>
                  )}
                  {l._count && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {l._count.projects} project(en)
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(l);
                      setFormOpen(true);
                    }}
                  >
                    Bewerken
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleting(l);
                    }}
                  >
                    Verwijderen
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LocationForm
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultValues={editing}
        onSubmit={(v) => upsert.mutate(v)}
        isPending={upsert.isPending}
      />

      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Locatie verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteError ? (
                <span className="text-destructive">{deleteError}</span>
              ) : (
                `"${deleting?.name}" definitief verwijderen?`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            {!deleteError && (
              <AlertDialogAction
                onClick={() => deleting && remove.mutate(deleting.id)}
              >
                Verwijderen
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
