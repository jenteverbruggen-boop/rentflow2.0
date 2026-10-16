"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { SupplierForm } from "@/components/supplier-form";
import { useSuppliers } from "@/hooks/use-suppliers";
import type { Supplier } from "@/types";

/** C3 — the companies material is hired in from. A supplier that is still in
 * use can't be deleted; archive it to take it out of the pickers. */
export default function LeveranciersPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { query, save, remove } = useSuppliers(showArchived);
  const suppliers = query.data ?? [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader title="Leveranciers">
        <Button variant="outline" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Verberg gearchiveerd" : "Toon gearchiveerd"}
        </Button>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>+ Nieuwe leverancier</Button>
      </PageHeader>

      {suppliers.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nog geen leveranciers. Voeg bedrijven toe waar je materiaal bij huurt dat je zelf niet in stock hebt.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {suppliers.map((s) => (
            <Card key={s.id} className={s.archived ? "opacity-60" : ""}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.name} {s.archived && <Badge variant="outline">Gearchiveerd</Badge>}</p>
                    <p className="truncate text-xs text-muted-foreground">{[s.contactName, s.phone, s.email].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Bewerken" onClick={() => { setEditing(s); setOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" title={s.archived ? "Herstellen" : "Archiveren"}
                      onClick={() => save.mutate({ id: s.id, values: { ...s, archived: !s.archived } })}>
                      {s.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" title="Verwijderen"
                      onClick={() => { if (confirm(`${s.name} verwijderen?`)) remove.mutate(s.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {(s.address || s.city) && (
                  <p className="text-xs text-muted-foreground">{[s.address, [s.postalCode, s.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>
                )}
                {s.notes && <p className="line-clamp-2 text-xs text-muted-foreground">{s.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {remove.isError && <p className="text-sm text-destructive">{remove.error.message}</p>}

      <SupplierForm
        open={open}
        onOpenChange={setOpen}
        defaultValues={editing}
        isPending={save.isPending}
        error={save.isError ? save.error.message : undefined}
        onSubmit={(values) => save.mutate({ id: editing?.id, values }, { onSuccess: () => setOpen(false) })}
      />
    </div>
  );
}
