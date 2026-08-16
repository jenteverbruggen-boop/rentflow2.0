import { Badge } from "@/components/ui/badge";
import type { InvoiceDisplayStatus } from "@/types";

const LABELS: Record<InvoiceDisplayStatus, string> = {
  concept: "Concept",
  verzonden: "Verzonden",
  gedeeltelijk_betaald: "Gedeeltelijk betaald",
  betaald: "Betaald",
  vervallen: "Vervallen",
  creditnota: "Creditnota",
};

const VARIANTS: Record<InvoiceDisplayStatus, "default" | "secondary" | "outline" | "destructive"> = {
  concept: "outline",
  verzonden: "secondary",
  gedeeltelijk_betaald: "secondary",
  betaald: "default",
  vervallen: "destructive",
  creditnota: "outline",
};

/** J2b.7 — renders the read-time-derived InvoiceDisplayStatus (design
 * doc §6.2), not the persisted `status` column directly. */
export function InvoiceStatusBadge({ status }: { status: InvoiceDisplayStatus }) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>;
}
