import { Separator } from "@/components/ui/separator";
import { formatEUR } from "@/lib/pricing";
import type { Invoice } from "@/types";

/** J2b.7 — the invoice-level equivalent of CostSummary
 * (cost-summary.tsx), extended with a deduction row and one VAT line
 * per distinct rate present (design doc §8.1) rather than one flat
 * BTW_RATE line — invoices never use pricing.ts's BTW_RATE constant
 * (§12: VAT is computed strictly per-line here). */
export function InvoiceSummary({ invoice }: { invoice: Invoice }) {
  const vatByRate = new Map<number, number>();
  for (const line of invoice.lines) {
    const amount = line.lineTotalExcl * (line.vatRate / 100);
    vatByRate.set(line.vatRate, (vatByRate.get(line.vatRate) ?? 0) + amount);
  }

  return (
    <div className="flex justify-end">
      <div className="text-right space-y-1 min-w-56">
        <Separator className="mb-2" />
        <div className="flex justify-between gap-6 text-sm">
          <span className="text-muted-foreground">Subtotaal</span>
          <span className="tabular-nums">{formatEUR(invoice.subtotalExcl)}</span>
        </div>
        {invoice.travelExcl !== 0 && (
          <div className="flex justify-between gap-6 text-sm">
            <span className="text-muted-foreground">Reiskosten</span>
            <span className="tabular-nums">{formatEUR(invoice.travelExcl)}</span>
          </div>
        )}
        {invoice.deductionExcl !== 0 && (
          <div className="flex justify-between gap-6 text-sm">
            <span className="text-muted-foreground">Reeds gefactureerd</span>
            <span className="tabular-nums">{formatEUR(invoice.deductionExcl)}</span>
          </div>
        )}
        <Separator className="my-1" />
        {[...vatByRate.entries()].map(([rate, amount]) => (
          <div key={rate} className="flex justify-between gap-6 text-sm">
            <span className="text-muted-foreground">BTW {rate}%</span>
            <span className="tabular-nums">{formatEUR(Math.round(amount * 100) / 100)}</span>
          </div>
        ))}
        <Separator className="my-1" />
        <div className="flex justify-between gap-6 items-baseline">
          <span className="text-xs text-muted-foreground">Totaal incl. BTW</span>
          <span className="text-2xl font-bold tabular-nums">{formatEUR(invoice.totalIncl)}</span>
        </div>
        {invoice.remainingBalance !== invoice.totalIncl && (
          <div className="flex justify-between gap-6 text-sm">
            <span className="text-muted-foreground">Openstaand</span>
            <span className="tabular-nums">{formatEUR(invoice.remainingBalance)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
