import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { statsPeriodInclude, serializeStatsPeriod } from "@/lib/serialize-stats-period";
import { monthsInRange } from "@/lib/stats-months";
import { aggregateBookedByMonth } from "@/lib/stats-booked";
import { aggregateBookedByClient } from "@/lib/stats-by-client";
import { aggregateInvoicedByMonth, aggregateInvoicedByClient } from "@/lib/stats-invoiced";
import { aggregatePersonUtilisation } from "@/lib/stats-utilisation";
import { computeTopMaterials } from "@/lib/stats-top-materials";
import { toNumber } from "@/lib/serialize";
import type { Period } from "@/types";

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * K1.1 — the lib half of GET /api/stats, split from the route so it's
 * testable against a real DB (this codebase's established pattern,
 * e.g. M1.4's apply-material-import.ts). Booked revenue is attributed
 * to the *period* it was booked on; invoiced revenue to the *invoice's
 * own* invoiceDate month — the two series will not line up and the UI
 * must say so, never imply otherwise.
 */
export async function computeStats(range: DateRange, client: PrismaClient = defaultPrisma) {
  const periodRows = await client.period.findMany({
    where: { AND: [{ startDate: { lt: range.to } }, { endDate: { gt: range.from } }] },
    include: { ...statsPeriodInclude, project: { include: { clientRel: true } } },
  });
  // serializeStatsPeriod converts Decimal money fields to numbers but
  // (like serializeProject's sibling) leaves date fields as native
  // Date/string mixes and Prisma's plain `String` billingUnit column
  // un-narrowed to the "dag"|"uur" union — every consumer below only
  // ever reads these via `new Date(x)` or an exact string-literal
  // comparison, both runtime-safe regardless of the exact TS shape.
  const periods = periodRows.map(serializeStatsPeriod) as unknown as Period[];

  const invoiceRows = await client.invoice.findMany({
    where: {
      invoiceDate: { gte: range.from, lte: range.to },
      status: { not: "concept" },
      kind: { not: "creditnota" },
    },
    include: { creditNotes: true },
  });
  // Invoice.clientName is itself a snapshot (design doc §3) — reused
  // as the name fallback for a client with invoiced revenue but no
  // booked period in range, rather than a second client query.
  const clientNames = new Map<number, string>();
  for (const inv of invoiceRows) clientNames.set(inv.clientId, inv.clientName);

  const invoices = invoiceRows.map((inv) => ({
    id: inv.id,
    kind: inv.kind,
    status: inv.status,
    clientId: inv.clientId,
    invoiceDate: inv.invoiceDate,
    subtotalExcl: toNumber(inv.subtotalExcl),
    travelExcl: toNumber(inv.travelExcl),
    deductionExcl: toNumber(inv.deductionExcl),
    creditNotes: inv.creditNotes
      .filter((cn) => cn.status !== "concept")
      .map((cn) => ({
        status: cn.status,
        subtotalExcl: toNumber(cn.subtotalExcl),
        travelExcl: toNumber(cn.travelExcl),
        deductionExcl: toNumber(cn.deductionExcl),
      })),
  }));

  const bookedByMonth = aggregateBookedByMonth(periods);
  const invoicedByMonth = aggregateInvoicedByMonth(invoices);
  const months = new Set([...monthsInRange(range.from, range.to), ...bookedByMonth.keys(), ...invoicedByMonth.keys()]);
  const revenueByMonth = [...months].sort().map((month) => {
    const booked = bookedByMonth.get(month);
    return {
      month,
      bookedPeople: booked?.bookedPeople ?? 0,
      bookedMaterials: booked?.bookedMaterials ?? 0,
      bookedTravel: booked?.bookedTravel ?? 0,
      booked: booked?.booked ?? 0,
      invoiced: invoicedByMonth.get(month) ?? 0,
    };
  });

  const bookedByClient = aggregateBookedByClient(
    periodRows.map((p, i) => ({
      period: periods[i],
      clientId: p.project.clientId,
      clientName: p.project.clientRel?.name ?? null,
    })),
  );
  const invoicedByClient = aggregateInvoicedByClient(invoices);
  const clientIds = new Set([...bookedByClient.keys(), ...invoicedByClient.keys()]);
  const revenueByClient = [...clientIds].map((clientId) => ({
    clientId,
    name: bookedByClient.get(clientId)?.name || clientNames.get(clientId) || "",
    booked: bookedByClient.get(clientId)?.booked ?? 0,
    invoiced: invoicedByClient.get(clientId) ?? 0,
  }));

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    revenueByMonth,
    revenueByClient,
    personUtilisation: aggregatePersonUtilisation(periods),
    topMaterials: computeTopMaterials(periods),
  };
}
