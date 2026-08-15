import type { PrismaClient } from "../../src/generated/prisma/client";

/**
 * DDL-3 — a representative spread of invoices, per
 * .plans/invoice-design.md §9: one concept draft, one verzonden not
 * yet due, one verzonden past due with no payments (displays
 * "vervallen" once J2b.6's derivation lands), one verzonden with a
 * partial payment ("gedeeltelijk_betaald"), one fully paid, one
 * deposit+final pair reproducing the design doc's own §4 worked
 * example numbers exactly, and one credit note against the paid
 * invoice.
 *
 * Hand-inserted directly (no J2b routes exist yet to generate these
 * through) — numbers are pre-allocated as if the atomic counter (§2)
 * had issued them in this order, and InvoiceCounter's lastSeq is set
 * to match so the first real finalisation once J2b.3 lands continues
 * the sequence rather than colliding with seed data.
 */

interface Client {
  id: number;
  name: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  vatNumber: string | null;
}

export async function seedInvoices(
  prisma: PrismaClient,
  client: Client,
  projectId: number,
) {
  const snapshot = {
    clientId: client.id,
    clientName: client.name,
    clientAddress: client.address,
    clientPostalCode: client.postalCode,
    clientCity: client.city,
    clientVatNumber: client.vatNumber,
    projectId,
  };

  // 1 — concept draft, never finalised: no number, fully mutable.
  await prisma.invoice.create({
    data: {
      ...snapshot,
      status: "concept",
      subtotalExcl: 400, vatAmount: 84, totalIncl: 484,
      lines: {
        create: [
          { kind: "material", description: "Materiaal (concept)", quantity: 1, unit: "stuk", unitPrice: 400, vatRate: 21, lineTotalExcl: 400, sortOrder: 0 },
        ],
      },
    },
  });

  // 2 — verzonden, not yet due.
  await prisma.invoice.create({
    data: {
      ...snapshot,
      status: "verzonden", number: "2026-0001", year: 2026,
      invoiceDate: new Date(2026, 6, 1), dueDate: new Date(2026, 6, 31),
      finalizedAt: new Date(2026, 6, 1),
      subtotalExcl: 800, travelExcl: 50, vatAmount: 178.5, totalIncl: 1028.5,
      lines: {
        create: [
          { section: "Event", kind: "material", description: "Materiaalhuur", quantity: 1, unit: "stuk", unitPrice: 800, vatRate: 21, lineTotalExcl: 800, sortOrder: 0 },
          { section: "Event", kind: "travel", description: "Reiskosten", quantity: 1, unit: "stuk", unitPrice: 50, vatRate: 21, lineTotalExcl: 50, sortOrder: 1 },
        ],
      },
    },
  });

  // 3 — verzonden, past its due date, no payments (→ "vervallen").
  await prisma.invoice.create({
    data: {
      ...snapshot,
      status: "verzonden", number: "2026-0002", year: 2026,
      invoiceDate: new Date(2026, 4, 1), dueDate: new Date(2026, 4, 31),
      finalizedAt: new Date(2026, 4, 1),
      subtotalExcl: 500, vatAmount: 105, totalIncl: 605,
      lines: {
        create: [
          { section: "Opbouw", kind: "person", description: "Medewerker", quantity: 2, unit: "dag", unitPrice: 250, vatRate: 21, lineTotalExcl: 500, sortOrder: 0 },
        ],
      },
    },
  });

  // 4 — verzonden with a partial payment (→ "gedeeltelijk_betaald").
  const partial = await prisma.invoice.create({
    data: {
      ...snapshot,
      status: "verzonden", number: "2026-0003", year: 2026,
      invoiceDate: new Date(2026, 6, 10), dueDate: new Date(2026, 7, 9),
      finalizedAt: new Date(2026, 6, 10),
      subtotalExcl: 1200, vatAmount: 252, totalIncl: 1452,
      lines: {
        create: [
          { section: "Event", kind: "material", description: "Materiaalhuur", quantity: 1, unit: "stuk", unitPrice: 1200, vatRate: 21, lineTotalExcl: 1200, sortOrder: 0 },
        ],
      },
    },
  });
  await prisma.payment.create({
    data: { invoiceId: partial.id, amount: 500, paidAt: new Date(2026, 6, 20) },
  });

  // 5 — betaald, fully paid.
  const paid = await prisma.invoice.create({
    data: {
      ...snapshot,
      status: "betaald", number: "2026-0004", year: 2026,
      invoiceDate: new Date(2026, 5, 1), dueDate: new Date(2026, 6, 1),
      finalizedAt: new Date(2026, 5, 1),
      subtotalExcl: 743.8, vatAmount: 156.2, totalIncl: 900,
      lines: {
        create: [
          { section: "Event", kind: "material", description: "Materiaalhuur", quantity: 1, unit: "stuk", unitPrice: 743.8, vatRate: 21, lineTotalExcl: 743.8, sortOrder: 0 },
        ],
      },
    },
  });
  await prisma.payment.create({
    data: { invoiceId: paid.id, amount: 900, paidAt: new Date(2026, 5, 20) },
  });

  // 6/7 — deposit + final pair, exactly reproducing invoice-design.md
  // §4's worked example (project "Zomerfestival", €3 700 excl. total).
  await prisma.invoice.create({
    data: {
      ...snapshot,
      status: "verzonden", number: "2026-0005", year: 2026,
      invoiceRole: "deposit", depositType: "percentage", depositPercentage: 30, depositBasisExcl: 3700,
      invoiceDate: new Date(2026, 5, 1), dueDate: new Date(2026, 5, 15),
      finalizedAt: new Date(2026, 5, 1),
      subtotalExcl: 1110, vatAmount: 233.1, totalIncl: 1343.1,
      lines: {
        create: [
          { kind: "deposit", description: "Voorschot 30% van projecttotaal (Zomerfestival)", quantity: 1, unit: "stuk", unitPrice: 1110, vatRate: 21, lineTotalExcl: 1110, sortOrder: 0 },
        ],
      },
    },
  });
  const final = await prisma.invoice.create({
    data: {
      ...snapshot,
      status: "betaald", number: "2026-0006", year: 2026,
      invoiceRole: "final",
      invoiceDate: new Date(2026, 6, 20), dueDate: new Date(2026, 7, 19),
      finalizedAt: new Date(2026, 6, 20),
      subtotalExcl: 3500, travelExcl: 200, deductionExcl: -1110, vatAmount: 543.9, totalIncl: 3133.9,
      lines: {
        create: [
          { section: "Opbouw", kind: "person", description: "Jan Peeters (opbouw)", quantity: 2, unit: "dag", unitPrice: 200, vatRate: 21, lineTotalExcl: 400, sortOrder: 0 },
          { section: "Opbouw", kind: "material", description: "Tent 10x15 x4", quantity: 4, unit: "stuk", unitPrice: 200, vatRate: 21, lineTotalExcl: 800, sortOrder: 1 },
          { section: "Opbouw", kind: "travel", description: "Reiskosten — Jan Peeters", quantity: 1, unit: "stuk", unitPrice: 50, vatRate: 21, lineTotalExcl: 50, sortOrder: 2 },
          { section: "Festivaldagen", kind: "person", description: "4 medewerkers", quantity: 8, unit: "dag", unitPrice: 200, vatRate: 21, lineTotalExcl: 1600, sortOrder: 3 },
          { section: "Festivaldagen", kind: "bundle", description: "Cocktailtafel + hoes x15", quantity: 15, unit: "stuk", unitPrice: 46.67, vatRate: 21, lineTotalExcl: 700, sortOrder: 4 },
          { section: "Festivaldagen", kind: "travel", description: "Reiskosten — diverse", quantity: 1, unit: "stuk", unitPrice: 150, vatRate: 21, lineTotalExcl: 150, sortOrder: 5 },
          { kind: "deduction", description: "Reeds gefactureerd: voorschotfactuur 2026-0005 (01/06/2026)", quantity: 1, unit: "stuk", unitPrice: -1110, vatRate: 21, lineTotalExcl: -1110, sortOrder: 6 },
        ],
      },
    },
  });
  await prisma.payment.create({
    data: { invoiceId: final.id, amount: 3133.9, paidAt: new Date(2026, 6, 25) },
  });

  // 8 — a credit note against the paid final invoice, own "credit" series.
  await prisma.invoice.create({
    data: {
      ...snapshot,
      kind: "creditnota", series: "credit",
      status: "verzonden", number: "CN-2026-0001", year: 2026,
      creditNoteOfId: final.id,
      invoiceDate: new Date(2026, 7, 1), finalizedAt: new Date(2026, 7, 1),
      subtotalExcl: -300, vatAmount: -63, totalIncl: -363,
      lines: {
        create: [
          { kind: "material", description: "Creditnota — geannuleerde tent", quantity: 1, unit: "stuk", unitPrice: -300, vatRate: 21, lineTotalExcl: -300, sortOrder: 0 },
        ],
      },
    },
  });

  // Pre-set both counters so the first real finalisation once J2b.3
  // lands continues the sequence rather than reusing a seeded number.
  await prisma.invoiceCounter.create({ data: { series: "invoice", year: 2026, lastSeq: 6 } });
  await prisma.invoiceCounter.create({ data: { series: "credit", year: 2026, lastSeq: 1 } });

  return { invoiceCount: 8 };
}
