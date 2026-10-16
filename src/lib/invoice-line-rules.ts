import type { InvoiceLineKind, InvoiceLineUnit } from "@/types";

export const roundMoney = (n: number): number => Math.round(n * 100) / 100;

/** Fields of a line that a caller may set or change. */
export interface LineFields {
  description: string;
  quantity: number;
  unit: InvoiceLineUnit;
  unitPrice: number;
  vatRate: number;
  section: string | null;
}

export class InvoiceLineEditError extends Error {}

type Current = { kind: string; quantity: number; unit: string; unitPrice: number; vatRate: number };

/**
 * Which edits a line of this kind accepts (enforced server-side — the UI
 * merely hides what the API would refuse). A value equal to the current one
 * is never an edit, so a client that echoes the whole row still passes.
 *
 * - `text` has no amounts at all; patching them would silently turn a
 *   paragraph into a priced line.
 * - `deduction` mirrors a deposit that was already invoiced.
 * - VAT rate and unit are only free on the PO's own `manual` lines:
 *   generated lines take the BTW setting, and a deposit/deduction pair must
 *   carry the same rate (design §4.2) or the deposit would be taxed twice.
 */
export function assertLinePatchAllowed(current: Current, patch: Partial<LineFields>): void {
  const changed = (key: "quantity" | "unit" | "unitPrice" | "vatRate") =>
    patch[key] !== undefined && patch[key] !== current[key];

  if (current.kind === "text" && (changed("quantity") || changed("unit") || changed("unitPrice") || changed("vatRate"))) {
    throw new InvoiceLineEditError("Een tekstregel heeft geen aantal, prijs of BTW");
  }
  if (current.kind === "deduction" && (changed("quantity") || changed("unit") || changed("unitPrice"))) {
    throw new InvoiceLineEditError("Een reeds gefactureerd voorschot kan niet aangepast worden");
  }
  if (current.kind !== "manual" && (changed("vatRate") || changed("unit"))) {
    throw new InvoiceLineEditError("BTW-tarief en eenheid kunnen enkel op eigen regels aangepast worden");
  }
}

/** Column values for a brand-new line. A text line is all zeros. */
export function newLineData(
  kind: Extract<InvoiceLineKind, "manual" | "text">,
  input: Pick<LineFields, "description"> & Partial<LineFields>,
  defaultVatRate: number,
) {
  if (kind === "text") {
    return { kind, description: input.description, quantity: 0, unit: "stuk", unitPrice: 0, vatRate: 0, lineTotalExcl: 0, section: input.section ?? null };
  }
  const quantity = input.quantity ?? 1;
  const unitPrice = roundMoney(input.unitPrice ?? 0);
  return {
    kind, description: input.description, quantity, unit: input.unit ?? "stuk", unitPrice,
    vatRate: input.vatRate ?? defaultVatRate, lineTotalExcl: roundMoney(quantity * unitPrice),
    section: input.section ?? null,
  };
}
