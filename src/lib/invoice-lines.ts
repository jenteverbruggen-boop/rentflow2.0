import type {
  Period,
  InvoiceRole,
  InvoiceLineKind,
  InvoiceLineUnit,
  DepositType,
} from "@/types";
import { periodDays, lineCost, billedUnits, projectCostSummary } from "@/lib/pricing";
import { groupMaterialAssignments } from "@/lib/grouping";
import { toNumber } from "@/lib/serialize";
import { personAndTravelLines } from "@/lib/invoice-lines-people";

export interface DraftInvoiceLine {
  section: string | null;
  kind: InvoiceLineKind;
  description: string;
  quantity: number;
  unit: InvoiceLineUnit;
  unitPrice: number;
  vatRate: number;
  lineTotalExcl: number;
  sortOrder: number;
  sourceKind: string | null;
  sourceId: number | null;
}

export interface PriorDeposit {
  /** The deposit invoice's id — lets a later correction of that deposit see
   * it was already deducted. Optional for hand-built fixtures. */
  id?: number;
  number: string;
  invoiceDate: string;
  netExcl: number;
  vatRate: number;
}

export interface GenerateDraftLinesOpts {
  invoiceRole: InvoiceRole;
  vatRate: number;
  depositType?: DepositType;
  depositValue?: number;
  priorDeposits?: PriorDeposit[];
  projectLabel: string;
}

/**
 * J2b.1 (invoice-design.md §5) — pure: no Prisma access, no persistence.
 * `standalone`/`final` group per period (Q24), reusing pricing.ts/
 * grouping.ts verbatim for every cost figure — never recomputed here.
 * `deposit` ignores periods for line generation but still derives its
 * basis from projectCostSummary(periods).total.
 */
export function generateDraftInvoiceLines(
  periods: Period[],
  opts: GenerateDraftLinesOpts,
): DraftInvoiceLine[] {
  if (opts.invoiceRole === "deposit") return depositLine(periods, opts);

  const lines = groupedLines(periods, opts.vatRate);
  if (opts.invoiceRole === "final") {
    lines.push(...deductionLines(opts.priorDeposits ?? [], lines.length));
  }
  return lines;
}

function depositLine(periods: Period[], opts: GenerateDraftLinesOpts): DraftInvoiceLine[] {
  const basis = projectCostSummary(periods).total;
  const isFixed = opts.depositType === "fixed";
  const unitPrice = isFixed
    ? opts.depositValue ?? 0
    : Math.round((basis * (opts.depositValue ?? 0)) / 100 * 100) / 100;
  const description = isFixed
    ? `Voorschot (${opts.projectLabel})`
    : `Voorschot ${opts.depositValue}% van projecttotaal (${opts.projectLabel})`;
  return [{
    section: null, kind: "deposit", description, quantity: 1, unit: "stuk",
    unitPrice, vatRate: opts.vatRate, lineTotalExcl: unitPrice, sortOrder: 0,
    sourceKind: null, sourceId: null,
  }];
}

export function deductionLines(priorDeposits: PriorDeposit[], startOrder: number): DraftInvoiceLine[] {
  return priorDeposits.map((entry, i) => ({
    section: null, kind: "deduction",
    description: `Reeds gefactureerd: voorschotfactuur ${entry.number} (${entry.invoiceDate})`,
    quantity: 1, unit: "stuk", unitPrice: -entry.netExcl, vatRate: entry.vatRate,
    lineTotalExcl: -entry.netExcl, sortOrder: startOrder + i,
    sourceKind: entry.id == null ? null : "priorDeposit", sourceId: entry.id ?? null,
  }));
}

function groupedLines(periods: Period[], vatRate: number): DraftInvoiceLine[] {
  const sorted = [...periods].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );
  const lines: DraftInvoiceLine[] = [];
  let sortOrder = 0;
  const push = (line: Omit<DraftInvoiceLine, "sortOrder">) => lines.push({ ...line, sortOrder: sortOrder++ });

  for (const period of sorted) {
    const days = periodDays(period);
    personAndTravelLines(period, days, vatRate, push);

    // Component units of a booked set are snapshotted at €0 and priced by the
    // set's own line below — listing them here would print "… × n à €0,00".
    // Overbooked units (shortages) are billed like owned ones.
    const flat = period.materials.filter((m) => !m.bundleBookingId);
    for (const g of groupMaterialAssignments(flat, period.shortages ?? [])) {
      const unitPrice = lineCost(g.dayPriceSnapshot, billedUnits(g.priceBasis, days), g);
      push({
        section: period.name, kind: "material", description: g.material.name,
        quantity: g.units, unit: "stuk", unitPrice, vatRate,
        lineTotalExcl: Math.round(unitPrice * g.units * 100) / 100,
        sourceKind: "stockItem", sourceId: null,
      });
      const setup =
        Math.round((g.assignments.reduce((s, a) => s + toNumber(a.setupCostSnapshot), 0) + g.overbookedSetup) * 100) / 100;
      if (setup > 0) {
        push({
          section: period.name, kind: "material", description: `Op-/afbouw — ${g.material.name}`,
          quantity: 1, unit: "stuk", unitPrice: setup, vatRate, lineTotalExcl: setup,
          sourceKind: "stockItem", sourceId: null,
        });
      }
    }

    for (const b of period.bundleBookings ?? []) {
      const unitPrice = Math.round(toNumber(b.dayPriceSnapshot) * days * 100) / 100;
      push({
        section: period.name, kind: "bundle", description: b.material?.name ?? "Set",
        quantity: b.quantity, unit: "stuk", unitPrice, vatRate,
        lineTotalExcl: Math.round(unitPrice * b.quantity * 100) / 100,
        sourceKind: "bundleBooking", sourceId: b.id,
      });
    }
  }

  return lines;
}
