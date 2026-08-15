import type { PrismaClient } from "../../src/generated/prisma/client";

/**
 * DDL-3 — chart-grade seed data (phase 3, K2's stats page cannot be
 * judged against the pre-existing 4-project/6-period/zero-bundle-
 * booking/zero-travel-cost seed). Extracted to its own file per
 * seed.ts's own "externalise bulk data for reviewability" convention
 * (materials.csv is the existing precedent) — not because of the
 * 150-line rule, which does not apply under prisma/.
 *
 * Adds ~16 more projects across all 12 months of 2026, travel costs on
 * roughly a third of person bookings, two real bundle bookings (with
 * PeriodBundleBookingComponent weight rows for K4), and a representative
 * spread of invoices across every status/kind combination the design
 * doc's §9 asks for.
 */

interface SeedRefs {
  clients: { id: number; name: string }[];
  locations: { id: number; name: string }[];
  people: { id: number; name: string; dayPrice: number }[];
  materials: Record<string, { id: number; dayPrice: number; stockItemIds: number[] }>;
  categoryMap: Record<string, { id: number }>;
}

function dt(month: number, day: number, hour = 9, minute = 0): Date {
  return new Date(2026, month - 1, day, hour, minute, 0);
}
function endOfDay2026(month: number, day: number): Date {
  return new Date(2026, month - 1, day, 23, 59, 59);
}

const PROJECT_NAMES = [
  "Nieuwjaarsreceptie Stadhuis", "Winterbeurs Expo", "Carnaval Optocht",
  "Lentemarkt Centrum", "Bedrijfsfeest TechCorp", "Schoolgala Sint-Lieven",
  "Beursvloer Sociale Zaken", "Zomerbar Kaai 12", "Foodtruck Festival",
  "Jubileum 25 jaar Vzw De Bron", "Wijnproeverij Kasteeltuin",
  "Halloween Spooktocht", "Sinterklaasfeest Wijkcentrum",
  "Kerstmarkt Grote Markt", "Nieuwjaarsconcert Concertzaal",
  "Beachvolleybal Toernooi",
];

/** One project per name above, spread deterministically across the
 * year so every month gets at least one on top of the original seed's
 * Apr–Nov coverage. Status follows the fictional "today" (2026-08-15,
 * per this project's own system context) — past months land afgerond
 * (one geannuleerd for variety), the current month actief, future
 * months concept/bevestigd. */
function statusForMonth(month: number, idx: number): string {
  if (month < 8) return idx === 2 ? "geannuleerd" : "afgerond";
  if (month === 8) return "actief";
  return idx % 2 === 0 ? "concept" : "bevestigd";
}

export async function seedChartGradeData(prisma: PrismaClient, refs: SeedRefs) {
  const { clients, locations, people, materials, categoryMap } = refs;
  const materialEntries = Object.entries(materials).filter(([, m]) => m.stockItemIds.length > 0);

  // Two extra flat materials + one real bundle booked twice (K4 needs
  // at least one booked-inside-a-set material to exercise its
  // pro-rata split against) — mirrors the design doc's own Cocktailtafel
  // + hoes worked example (K4, Q48) so a later manual check against
  // seed data lines up with that example's numbers.
  const table = await prisma.material.create({
    data: { name: "Cocktailtafel", category: "Meubilair", categoryId: categoryMap["Meubilair"]?.id, dayPrice: 5, code: "SEED-TAFEL" },
  });
  const cover = await prisma.material.create({
    data: { name: "Cocktailtafelhoes", category: "Meubilair", categoryId: categoryMap["Meubilair"]?.id, dayPrice: 3, code: "SEED-HOES" },
  });
  await prisma.stockItem.createMany({
    data: Array.from({ length: 10 }, (_, i) => ({ materialId: table.id, unitNumber: i + 1 })),
  });
  await prisma.stockItem.createMany({
    data: Array.from({ length: 10 }, (_, i) => ({ materialId: cover.id, unitNumber: i + 1 })),
  });
  const bundleSet = await prisma.material.create({
    data: {
      name: "Cocktailtafel met hoes",
      category: "Meubilair",
      categoryId: categoryMap["Meubilair"]?.id,
      isBundle: true,
      dayPrice: 8,
      code: "SEED-SET",
      components: {
        create: [
          { childId: table.id, quantity: 1 },
          { childId: cover.id, quantity: 1 },
        ],
      },
    },
  });

  let travelCostCount = 0;
  let personBookingCount = 0;
  let bundleBookingsWritten = 0;

  for (let i = 0; i < PROJECT_NAMES.length; i++) {
    const month = (i % 12) + 1;
    const client = clients[i % clients.length];
    const location = locations[i % locations.length];
    const status = statusForMonth(month, i);
    const startDay = 3 + (i % 5);
    const endDay = Math.min(28, startDay + 2 + (i % 3));

    const project = await prisma.project.create({
      data: {
        name: PROJECT_NAMES[i],
        client: client.name,
        clientId: client.id,
        location: location.name,
        locationId: location.id,
        startDate: dt(month, startDay, 8),
        endDate: endOfDay2026(month, endDay),
        status,
        notes: `Gegenereerd voor grafiek-testdata (${month}/2026).`,
        periods: {
          create: [
            { name: "Opbouw", startDate: dt(month, startDay, 8), endDate: endOfDay2026(month, startDay) },
            { name: "Event", startDate: dt(month, startDay + 1, 9), endDate: endOfDay2026(month, endDay) },
            { name: "Afbouw", startDate: dt(month, endDay + 1, 8), endDate: endOfDay2026(month, Math.min(28, endDay + 1)) },
          ],
        },
      },
      include: { periods: true },
    });

    for (const period of project.periods) {
      const person = people[(i + project.periods.indexOf(period)) % people.length];
      const pp = await prisma.periodPerson.create({
        data: {
          periodId: period.id,
          personId: person.id,
          dayPriceSnapshot: person.dayPrice,
        },
      });
      personBookingCount++;
      // ~a third of person bookings get an itemised travel cost line.
      if (personBookingCount % 3 === 0) {
        await prisma.personTravelCost.create({
          data: { periodPersonId: pp.id, label: "Verplaatsing", unitCost: 25, quantity: 2 },
        });
        travelCostCount++;
      }

      if (materialEntries.length > 0) {
        const [, mat] = materialEntries[i % materialEntries.length];
        const stockItemId = mat.stockItemIds[0];
        if (stockItemId) {
          await prisma.periodStockItem.create({
            data: { periodId: period.id, stockItemId, dayPriceSnapshot: mat.dayPrice },
          });
        }
      }
    }

    // Book the Cocktailtafel-met-hoes set on two of these projects'
    // first ("Event") period — enough for K4's bundle-split path to be
    // exercised, per DDL-3's "at least 2 booked bundles" requirement.
    if (bundleBookingsWritten < 2) {
      const period = project.periods[1];
      const quantity = bundleBookingsWritten === 0 ? 3 : 2;
      const bundleBooking = await prisma.periodBundleBooking.create({
        data: { periodId: period.id, materialId: bundleSet.id, quantity, dayPriceSnapshot: 8 },
      });
      await prisma.periodBundleBookingComponent.createMany({
        data: [
          { bundleBookingId: bundleBooking.id, materialId: table.id, quantity: 1, dayPriceAtBooking: 5 },
          { bundleBookingId: bundleBooking.id, materialId: cover.id, quantity: 1, dayPriceAtBooking: 3 },
        ],
      });
      const tableStock = await prisma.stockItem.findMany({ where: { materialId: table.id }, take: quantity });
      const coverStock = await prisma.stockItem.findMany({ where: { materialId: cover.id }, take: quantity });
      await prisma.periodStockItem.createMany({
        data: [...tableStock, ...coverStock].map((s) => ({
          periodId: period.id,
          stockItemId: s.id,
          dayPriceSnapshot: 0,
          bundleBookingId: bundleBooking.id,
        })),
      });
      bundleBookingsWritten++;
    }
  }

  return { projectCount: PROJECT_NAMES.length, travelCostCount, personBookingCount, bundleBookingsWritten };
}
