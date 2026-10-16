"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { ConvertQuoteDialog } from "@/components/convert-quote-dialog";
import { useInvoice } from "@/hooks/use-invoice";
import { useQuoteActions } from "@/hooks/use-quotes";
import type { Invoice } from "@/types";

interface Props {
  quote: Invoice;
  onRegenerate: () => void;
}

/** Title, status and the actions that fit the quote's status: a draft is
 * sent, a sent quote is accepted / refused / reopened, an accepted one is
 * converted into an invoice. */
export function QuoteDetailHeader({ quote, onRegenerate }: Props) {
  const router = useRouter();
  const [convertOpen, setConvertOpen] = useState(false);
  const { remove, regenerate, refreshClient } = useInvoice(quote.id);
  const { send, reopen, reject, accept, convert } = useQuoteActions(quote.id);
  const error = [send, reopen, reject, accept, regenerate, refreshClient].find((m) => m.isError)?.error?.message;
  const isDraft = quote.status === "concept";

  return (
    <>
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold truncate">{quote.number ?? `Offerte (concept #${quote.id})`}</h2>
            <InvoiceStatusBadge status={quote.displayStatus} />
          </div>
          <p className="text-sm text-muted-foreground truncate">{quote.clientName}</p>
          {quote.validUntil && quote.status !== "concept" && (
            <p className="text-xs text-muted-foreground">Geldig tot {new Date(quote.validUntil).toLocaleDateString("nl-BE")}</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={`/offertes/${quote.id}/print?autoprint=1`}><Button variant="outline">Afdrukken</Button></Link>
          {isDraft && (
            <>
              <Button variant="outline" onClick={onRegenerate} disabled={regenerate.isPending}>Opnieuw genereren</Button>
              <Button variant="outline" onClick={() => refreshClient.mutate()} disabled={refreshClient.isPending}>Klantgegevens verversen</Button>
              <Button onClick={() => send.mutate()} disabled={send.isPending}>Verzenden</Button>
              <Button variant="outline" onClick={() => remove.mutate(undefined, { onSuccess: () => router.push("/offertes") })}>Verwijderen</Button>
            </>
          )}
          {quote.status === "verzonden" && (
            <>
              <Button variant="outline" onClick={() => reopen.mutate()} disabled={reopen.isPending}>Bewerken</Button>
              <Button variant="outline" onClick={() => reject.mutate()} disabled={reject.isPending}>Geweigerd</Button>
              <Button onClick={() => accept.mutate()} disabled={accept.isPending}>Aanvaard</Button>
            </>
          )}
          {quote.status === "aanvaard" && <Button onClick={() => setConvertOpen(true)}>Omzetten naar factuur</Button>}
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ConvertQuoteDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        isPending={convert.isPending}
        error={convert.isError ? convert.error.message : undefined}
        onConvert={(values) => convert.mutate(values, { onSuccess: (inv) => router.push(`/facturen/${inv.id}`) })}
      />
    </>
  );
}
