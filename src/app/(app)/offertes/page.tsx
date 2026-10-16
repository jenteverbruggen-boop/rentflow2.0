"use client";

import { useState } from "react";
import Link from "next/link";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { formatEUR } from "@/lib/pricing";
import { useQuotes } from "@/hooks/use-quotes";

const STATUS_OPTIONS = [
  { value: "all", label: "Alle statussen" },
  { value: "concept", label: "Concept" },
  { value: "verzonden", label: "Verzonden" },
  { value: "aanvaard", label: "Aanvaard" },
  { value: "geweigerd", label: "Geweigerd" },
];

/** C2 — overview of quotes. A new quote starts from a project's Kosten tab,
 * since a quote prices that project's bookings. */
export default function OffertesPage() {
  const [status, setStatus] = useState("all");
  const { query } = useQuotes(status === "all" ? {} : { status });
  const quotes = query.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Offertes">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </PageHeader>

      {quotes.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Geen offertes gevonden. Maak er een via de tab Kosten van een project.
        </p>
      ) : (
        <div className="border rounded-lg overflow-x-auto bg-card">
          <Table className="table-sticky-first">
            <TableHeader>
              <TableRow>
                <TableHead>Nummer</TableHead>
                <TableHead>Klant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Geldig tot</TableHead>
                <TableHead className="text-right">Totaal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>
                    <Link href={`/offertes/${q.id}`} className="hover:underline font-medium">
                      {q.number ?? `Concept #${q.id}`}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-40 truncate">{q.clientName}</TableCell>
                  <TableCell><InvoiceStatusBadge status={q.displayStatus} /></TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                    {q.validUntil ? new Date(q.validUntil).toLocaleDateString("nl-BE") : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatEUR(q.totalIncl)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
