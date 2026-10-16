import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InvoiceDisplayStatus } from "@/types";

const LABELS: Record<InvoiceDisplayStatus, string> = {
  concept: "Concept",
  verzonden: "Verzonden",
  gedeeltelijk_betaald: "Gedeeltelijk betaald",
  betaald: "Betaald",
  vervallen: "Vervallen",
  creditnota: "Creditnota",
};

// Soft tinted pills instead of solid fills: a list with many overdue
// invoices should not be a wall of saturated red. Text colours are picked
// per theme for WCAG AA on the tint.
const TONES: Record<InvoiceDisplayStatus, string> = {
  concept: "text-muted-foreground",
  verzonden: "border-blue-600/30 bg-blue-600/10 text-blue-700 dark:text-blue-300",
  gedeeltelijk_betaald: "border-amber-600/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  betaald: "border-green-600/30 bg-green-600/10 text-green-800 dark:text-green-300",
  vervallen: "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-300",
  creditnota: "text-muted-foreground",
};

/** J2b.7 — renders the read-time-derived InvoiceDisplayStatus (design
 * doc §6.2), not the persisted `status` column directly. */
export function InvoiceStatusBadge({ status }: { status: InvoiceDisplayStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONES[status])}>
      {LABELS[status]}
    </Badge>
  );
}
