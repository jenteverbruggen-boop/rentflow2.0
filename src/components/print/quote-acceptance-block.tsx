import { format } from "date-fns";
import { nl } from "date-fns/locale";
import type { Invoice } from "@/types";

/** The closing blocks of a quote: remarks, how long it holds, and a "voor
 * akkoord" box to sign — a quote asks for agreement, not payment. */
export function QuoteAcceptanceBlock({ invoice }: { invoice: Invoice }) {
  const footer = invoice.footer;
  return (
    <div className="space-y-4 break-inside-avoid">
      {invoice.notes && (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Opmerkingen</p>
          <p className="whitespace-pre-line text-sm">{invoice.notes}</p>
        </div>
      )}
      <div className="rounded-md border p-4 text-sm print:rounded-none">
        <p className="font-semibold">
          Gelezen en goedgekeurd — voor akkoord
          {invoice.validUntil && (
            <span className="font-normal text-muted-foreground">
              {" "}— deze offerte is geldig tot {format(new Date(invoice.validUntil), "dd-MM-yyyy", { locale: nl })}
            </span>
          )}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Door te ondertekenen gaat u akkoord met deze offerte en de vermelde afspraken.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-6 text-xs text-muted-foreground">
          {["Naam", "Datum", "Handtekening"].map((label) => (
            <div key={label} className="border-t border-foreground/40 pt-1">{label}</div>
          ))}
        </div>
      </div>
      {footer && <p className="text-xs text-muted-foreground">{footer}</p>}
    </div>
  );
}
