"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Client } from "@/types";

interface Props {
  clients: Client[];
  onRates: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
}

/** Extracted from clients/page.tsx (L3.1) — pure move, no behaviour
 * change beyond the new "Tarieven" button that opens
 * ClientRatesDialog. */
export function ClientList({ clients, onRates, onEdit, onDelete }: Props) {
  if (clients.length === 0) {
    return <p className="text-muted-foreground">Nog geen klanten.</p>;
  }

  return (
    <div className="grid gap-3">
      {clients.map((c) => (
        <Card key={c.id}>
          <CardContent className="py-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{c.name}</p>
              {c.contactName && (
                <p className="text-sm text-muted-foreground">{c.contactName}</p>
              )}
              {[c.email, c.phone].filter(Boolean).join(" · ") && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[c.email, c.phone].filter(Boolean).join(" · ")}
                </p>
              )}
              {c._count && (
                <Badge variant="secondary" className="mt-1 text-xs">
                  {c._count.projects} project(en)
                </Badge>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => onRates(c)}>
                Tarieven
              </Button>
              <Button size="sm" variant="outline" onClick={() => onEdit(c)}>
                Bewerken
              </Button>
              <Button size="sm" variant="destructive" onClick={() => onDelete(c)}>
                Verwijderen
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
