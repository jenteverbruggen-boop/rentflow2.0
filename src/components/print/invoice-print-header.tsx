import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { CompanyBlock, type CompanyInfo } from "@/components/print/document-header";
import type { Invoice } from "@/types";

const fmtDate = (d: string) => format(new Date(d), "dd-MM-yyyy", { locale: nl });

/** The top of an invoice or credit note: company block left, document title
 * and number right, then the billing address next to the date/reference
 * grid. Every field is optional — a concept simply has no number or dates. */
export function InvoicePrintHeader({ invoice, company }: { invoice: Invoice; company: CompanyInfo }) {
  const isCredit = invoice.kind === "creditnota";
  const isQuote = invoice.kind === "offerte";
  const address = [invoice.clientAddress, [invoice.clientPostalCode, invoice.clientCity].filter(Boolean).join(" ")].filter(Boolean);
  const dateLabel = isCredit ? "Creditnotadatum" : isQuote ? "Offertedatum" : "Factuurdatum";
  const meta: [string, string | null | undefined][] = [
    [dateLabel, invoice.invoiceDate ? fmtDate(invoice.invoiceDate) : null],
    ...(isQuote ? ([["Geldig tot", invoice.validUntil ? fmtDate(invoice.validUntil) : null]] as [string, string | null][]) : []),
    ...(isCredit || isQuote ? [] : ([["Vervaldatum", invoice.dueDate ? fmtDate(invoice.dueDate) : null]] as [string, string | null][])),
    ...(isCredit || isQuote ? [] : ([["Mededeling", invoice.paymentReference]] as [string, string | null][])),
    ...(invoice.sourceQuoteNumber ? ([["Volgens offerte", invoice.sourceQuoteNumber]] as [string, string][]) : []),
    ...(invoice.correctionOfNumber ? ([["Vervangt factuur", invoice.correctionOfNumber]] as [string, string][]) : []),
  ];

  return (
    <header className="space-y-8">
      <div className="flex items-start justify-between gap-6">
        <CompanyBlock company={company} showIban={false} />
        <div className="text-right">
          <h1 className="text-3xl font-bold tracking-tight">{isCredit ? "Creditnota" : isQuote ? "Offerte" : "Factuur"}</h1>
          <p className="text-lg tabular-nums">{invoice.number ?? `Concept #${invoice.id}`}</p>
        </div>
      </div>

      <div className="flex items-start justify-between gap-6">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{isCredit ? "Klant" : isQuote ? "Offerte voor" : "Factureren aan"}</p>
          <p className="font-medium">{invoice.clientName}</p>
          {address.map((line) => <p key={line} className="text-sm">{line}</p>)}
          {invoice.clientVatNumber && <p className="text-sm">BTW: {invoice.clientVatNumber}</p>}
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm">
          {meta.filter(([, v]) => v).map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right tabular-nums">{value}</dd>
            </div>
          ))}
          {isCredit && invoice.creditNoteOfNumber && (
            <div className="contents">
              <dt className="text-muted-foreground">Betreft factuur</dt>
              <dd className="text-right tabular-nums">
                {invoice.creditNoteOfNumber}
                {invoice.creditNoteOfDate ? ` van ${fmtDate(invoice.creditNoteOfDate)}` : ""}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </header>
  );
}
