import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { formatEUR } from "@/lib/pricing";
import type { Invoice } from "@/types";

interface Props {
  invoice: Invoice;
  settings: Record<string, string>;
}

/** Remarks, how and when to pay, and the footer — the closing blocks of an
 * invoice. A credit note takes no payment, so it only gets remarks + footer. */
export function InvoicePaymentBlock({ invoice, settings }: Props) {
  const isCredit = invoice.kind === "creditnota";
  // The company footer is mostly payment wording ("gelieve te betalen…"): a
  // credit note only shows a footer written for it.
  const footer = isCredit ? invoice.footer : (invoice.footer ?? settings.invoiceFooter);
  const iban = [settings.companyIban, settings.invoiceBankAccountHolder && `t.n.v. ${settings.invoiceBankAccountHolder}`]
    .filter(Boolean).join(" — ");
  const open = invoice.status !== "concept" ? invoice.remainingBalance : invoice.totalIncl;

  return (
    <div className="space-y-4 break-inside-avoid">
      {invoice.notes && (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Opmerkingen</p>
          <p className="whitespace-pre-line text-sm">{invoice.notes}</p>
        </div>
      )}

      {!isCredit && (
        <div className="rounded-md border p-4 text-sm print:rounded-none">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            {open > 0 ? (
              <p className="font-semibold">
                Te betalen: <span className="tabular-nums">{formatEUR(open)}</span>
                {invoice.dueDate && <span className="font-normal"> vóór {format(new Date(invoice.dueDate), "dd-MM-yyyy", { locale: nl })}</span>}
              </p>
            ) : (
              <p className="font-semibold">
                {open === 0 ? "Volledig betaald" : <>Tegoed: <span className="tabular-nums">{formatEUR(-open)}</span></>}
              </p>
            )}
            {invoice.status === "concept" && (
              <p className="text-xs text-muted-foreground">
                Betalingstermijn: {invoice.paymentTermDays ?? settings.invoicePaymentTermDays ?? 30} dagen
              </p>
            )}
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
            {iban && (<><dt className="text-muted-foreground">Rekening</dt><dd>{iban}</dd></>)}
            {invoice.paymentReference && (
              <><dt className="text-muted-foreground">Mededeling</dt><dd className="tabular-nums">{invoice.paymentReference}</dd></>
            )}
          </dl>
        </div>
      )}

      {footer && <p className="text-xs text-muted-foreground">{footer}</p>}
    </div>
  );
}
