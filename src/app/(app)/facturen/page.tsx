"use client";

import { useState } from "react";
import Link from "next/link";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { formatEUR } from "@/lib/pricing";
import { useInvoices } from "@/hooks/use-invoices";

const STATUS_OPTIONS = [
  { value: "all", label: "Alle statussen" },
  { value: "concept", label: "Concept" },
  { value: "verzonden", label: "Verzonden" },
  { value: "betaald", label: "Betaald" },
  { value: "creditnota", label: "Creditnota's" },
];

/** J2b.7 — overview: status filter, table, links to detail. Client/
 * project filters exist server-side (GET /api/invoices?clientId=&
 * projectId=) but have no UI control yet here — reachable today via
 * project-invoices-list.tsx on each project's own Kosten tab. */
export default function FacturenPage() {
  const [status, setStatus] = useState("all");
  const filters = status === "all" ? {} : status === "creditnota" ? { kind: "creditnota" } : { status };
  const { query } = useInvoices(filters);
  const invoices = query.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Facturen</h2>
        <div className="flex gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <a href="/api/invoices/export" target="_blank" rel="noreferrer">
            <Button variant="outline">⬇️ Exporteren</Button>
          </a>
        </div>
      </div>

      {invoices.length === 0 ? (
        <p className="text-muted-foreground text-sm">Geen facturen gevonden.</p>
      ) : (
        <div className="border rounded-lg overflow-x-auto bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nummer</TableHead>
                <TableHead>Klant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Datum</TableHead>
                <TableHead className="text-right">Totaal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link href={`/facturen/${inv.id}`} className="hover:underline font-medium">
                      {inv.number ?? `Concept #${inv.id}`}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-40 truncate">{inv.clientName}</TableCell>
                  <TableCell><InvoiceStatusBadge status={inv.displayStatus} /></TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                    {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("nl-BE") : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatEUR(inv.totalIncl)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
