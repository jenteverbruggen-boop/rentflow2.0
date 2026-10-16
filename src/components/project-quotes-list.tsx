import Link from "next/link";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { formatEUR } from "@/lib/pricing";
import { useQuotes } from "@/hooks/use-quotes";

/** A project's own quotes (number, status, total, link) on its Kosten tab.
 * Renders nothing when there are none. */
export function ProjectQuotesList({ projectId }: { projectId: number }) {
  const { query } = useQuotes({ projectId });
  const quotes = query.data ?? [];
  if (quotes.length === 0) return null;

  return (
    <div className="space-y-2 no-print">
      <h3 className="text-sm font-semibold">Offertes</h3>
      <ul className="space-y-1">
        {quotes.map((q) => (
          <li key={q.id}>
            <Link href={`/offertes/${q.id}`} className="flex justify-between items-center text-sm hover:underline">
              <span className="flex items-center gap-2">
                {q.number ?? `Concept #${q.id}`}
                <InvoiceStatusBadge status={q.displayStatus} />
              </span>
              <span className="tabular-nums">{formatEUR(q.totalIncl)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
