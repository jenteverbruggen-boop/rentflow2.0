import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, conflict, notFound, serverError } from "@/lib/api-auth";
import { effectiveMaterialPrice } from "@/lib/effective-price";

type Params = { params: Promise<{ id: string }> };

async function availableForMaterial(materialId: number, from: Date, to: Date): Promise<number[]> {
  const all = await prisma.stockItem.findMany({ where: { materialId }, orderBy: { unitNumber: "asc" }, select: { id: true } });
  const booked = await prisma.periodStockItem.findMany({
    where: {
      stockItem: { materialId },
      period: { AND: [{ startDate: { lt: to } }, { endDate: { gt: from } }] },
    },
    select: { stockItemId: true },
  });
  const bookedIds = new Set(booked.map((b) => b.stockItemId));
  return all.filter((s) => !bookedIds.has(s.id)).map((s) => s.id);
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const periodId = parseInt(id);
    const { materialId, quantity, discountPct, discountAmount } = await req.json();
    const qty = Math.max(1, parseInt(quantity) || 0);
    if (!materialId || !qty) return badRequest("materialId en quantity zijn verplicht");

    const period = await prisma.period.findUnique({ where: { id: periodId } });
    if (!period) return notFound();

    const material = await prisma.material.findUnique({
      where: { id: parseInt(materialId) },
      include: { components: { include: { child: { include: { stockItems: true } } } } },
    });
    if (!material) return notFound();

    if (material.isBundle) {
      return bookBundle(period, material, qty);
    }

    // Flat booking — move availability check inside transaction via create+catch
    const snapshotPrice = await effectiveMaterialPrice(period.projectId, parseInt(materialId));
    const availIds = await availableForMaterial(parseInt(materialId), period.startDate, period.endDate);

    if (availIds.length < qty) {
      return conflict(`Niet genoeg vrij. Gevraagd: ${qty}, beschikbaar: ${availIds.length}`);
    }

    const chosen = availIds.slice(0, qty);
    try {
      const created = await prisma.$transaction(
        chosen.map((stockItemId) =>
          prisma.periodStockItem.create({
            data: {
              periodId,
              stockItemId,
              dayPriceSnapshot: snapshotPrice,
              discountPct: discountPct != null ? Number(discountPct) : null,
              discountAmount: discountAmount != null ? Number(discountAmount) : null,
            },
            include: { stockItem: { include: { material: { include: { categoryRel: true } } } } },
          })
        )
      );
      return NextResponse.json({ assignments: created, warnings: [] });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002") {
        return conflict("Conflict bij gelijktijdige boeking — probeer opnieuw");
      }
      throw e;
    }
  } catch (err) {
    return serverError((err as Error).message);
  }
}

type PrismaFullMaterial = {
  id: number; projectId?: number;
  components: { childId: number; quantity: number; child: { id: number; dayPrice: unknown; stockItems: { id: number }[] } }[];
};

async function bookBundle(
  period: { id: number; projectId: number; startDate: Date; endDate: Date },
  material: { id: number; dayPrice: unknown; bundlePriceOverride: unknown; components: { childId: number; quantity: number; child: { id: number; dayPrice: unknown; stockItems: { id: number }[] } }[] },
  quantity: number
): Promise<NextResponse> {
  const components = material.components;
  if (components.length === 0) return badRequest("Bundle heeft geen componenten");

  // Compute price snapshot
  const componentSum = components.reduce(
    (acc, c) => acc + Number(c.child.dayPrice) * c.quantity,
    0
  );
  const snapshotPrice = material.bundlePriceOverride != null
    ? Number(material.bundlePriceOverride)
    : componentSum;

  try {
    const booking = await prisma.$transaction(async (tx) => {
      // Re-check availability INSIDE transaction
      for (const comp of components) {
        const allItems = await tx.stockItem.findMany({
          where: { materialId: comp.childId },
          select: { id: true },
        });
        const booked = await tx.periodStockItem.findMany({
          where: {
            stockItemId: { in: allItems.map((s) => s.id) },
            period: {
              AND: [
                { startDate: { lt: period.endDate } },
                { endDate: { gt: period.startDate } },
              ],
            },
          },
          select: { stockItemId: true },
        });
        const bookedIds = new Set(booked.map((b) => b.stockItemId));
        const availCount = allItems.filter((s) => !bookedIds.has(s.id)).length;
        const needed = comp.quantity * quantity;
        if (availCount < needed) {
          throw Object.assign(new Error(`Onvoldoende voorraad voor component: ${comp.childId}`), { code: "BUNDLE_UNAVAIL", childId: comp.childId });
        }
      }

      // Create the bundle booking
      const bBooking = await tx.periodBundleBooking.create({
        data: { periodId: period.id, materialId: material.id, quantity, dayPriceSnapshot: snapshotPrice },
      });

      // Reserve component stock items
      for (const comp of components) {
        const allItems = await tx.stockItem.findMany({
          where: { materialId: comp.childId },
          orderBy: { unitNumber: "asc" },
          select: { id: true },
        });
        const booked = await tx.periodStockItem.findMany({
          where: {
            stockItemId: { in: allItems.map((s) => s.id) },
            period: {
              AND: [
                { startDate: { lt: period.endDate } },
                { endDate: { gt: period.startDate } },
              ],
            },
          },
          select: { stockItemId: true },
        });
        const bookedSet = new Set(booked.map((b) => b.stockItemId));
        const freeIds = allItems.filter((s) => !bookedSet.has(s.id)).slice(0, comp.quantity * quantity).map((s) => s.id);

        await tx.periodStockItem.createMany({
          data: freeIds.map((stockItemId) => ({
            periodId: period.id,
            stockItemId,
            dayPriceSnapshot: 0,
            bundleBookingId: bBooking.id,
          })),
        });
      }

      return bBooking;
    });

    return NextResponse.json({ bundleBooking: booking, warnings: [] });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === "BUNDLE_UNAVAIL") return conflict(err.message ?? "Onvoldoende voorraad");
    if (err.code === "P2002") return conflict("Conflict bij gelijktijdige boeking — probeer opnieuw");
    return serverError(err.message ?? "Onbekende fout");
  }
}
