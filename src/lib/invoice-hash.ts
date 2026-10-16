import { createHash } from "node:crypto";
import type { DraftInvoiceLine } from "@/lib/invoice-lines";

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Fingerprint of what the line generator produced (section, kind,
 * description, quantity, prices, VAT, total — money at 2 decimals). It is
 * stored on the draft when it is generated and compared with a fresh run to
 * tell the PO "the project changed since this draft was made". Comparing
 * generator output with generator output means inline edits of lines and
 * Decimal-vs-Float noise can't raise a false alarm.
 */
export function hashDraftLines(lines: DraftInvoiceLine[]): string {
  const normalized = lines.map((l) => [
    l.section ?? "", l.kind, l.description, cents(l.quantity), l.unit, cents(l.unitPrice), cents(l.vatRate), cents(l.lineTotalExcl),
  ]);
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}
