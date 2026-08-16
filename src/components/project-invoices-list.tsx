import Link from "next/link";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { formatEUR } from "@/lib/pricing";
import { useInvoices } from "@/hooks/use-invoices";

/** J2b.7 — mini-list of a project's own invoices (number, status
 * badge, total, link) — extracted so project-costs-tab.tsx doesn't
 * grow past 150 lines again. Renders nothing when the project has no
 * invoices yet. */
export function ProjectInvoicesList({ projectId }: { projectId: number }) {
  const { query } = useInvoices({ projectId });
  const invoices = query.data ?? [];
  if (invoices.length === 0) return null;

  return (
    <div className="space-y-2 no-print">
      <h3 className="text-sm font-semibold">Facturen</h3>
      <ul className="space-y-1">
        {invoices.map((inv) => (
          <li key={inv.id}>
            <Link href={`/facturen/${inv.id}`} className="flex justify-between items-center text-sm hover:underline">
              <span className="flex items-center gap-2">
                {inv.number ?? `Concept #${inv.id}`}
                <InvoiceStatusBadge status={inv.displayStatus} />
              </span>
              <span className="tabular-nums">{formatEUR(inv.totalIncl)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
