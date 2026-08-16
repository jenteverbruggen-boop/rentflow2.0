/**
 * J2b.4 (invoice-design.md §3) — freezing is enforced at the API, not
 * by convention. Every route that would mutate `InvoiceLine` rows or
 * `Invoice` totals — PATCH /api/invoices/:id, POST/PATCH/DELETE
 * /api/invoices/:id/lines(/:lineId), POST .../regenerate, DELETE
 * /api/invoices/:id — opens with this same guard. No route is allowed
 * to special-case an exception to it.
 */
export class DraftNotMutableError extends Error {
  constructor() {
    super("Factuur is al verzonden — niet meer te wijzigen");
  }
}

export function assertDraftMutable(invoice: { status: string }): void {
  if (invoice.status !== "concept") throw new DraftNotMutableError();
}
