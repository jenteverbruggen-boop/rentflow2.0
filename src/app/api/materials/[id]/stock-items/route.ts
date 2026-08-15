import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, resolveCurrentAccess, unauthorized, serverError } from "@/lib/api-auth";
import { toNumber, toNumberOrNull } from "@/lib/serialize";
import { redactMoney } from "@/lib/redact";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    const access = await resolveCurrentAccess();
    const items = await prisma.stockItem.findMany({
      where: { materialId: parseInt(id) },
      orderBy: { unitNumber: "asc" },
      include: {
        assignments: {
          orderBy: { id: "desc" },
          include: {
            period: {
              select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                project: {
                  select: {
                    id: true,
                    name: true,
                    status: true,
                    location: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    return NextResponse.json(
      items.map((item) =>
        redactMoney(
          {
            ...item,
            assignments: item.assignments.map((a) => ({
              ...a,
              dayPriceSnapshot: toNumber(a.dayPriceSnapshot),
              setupCostSnapshot: toNumberOrNull(a.setupCostSnapshot),
              discountPct: toNumberOrNull(a.discountPct),
              discountAmount: toNumberOrNull(a.discountAmount),
            })),
          },
          access,
        ),
      ),
    );
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const { id } = await params;
    const materialId = parseInt(id);
    const { identifier, notes } = await req.json();
    const last = await prisma.stockItem.findFirst({
      where: { materialId },
      orderBy: { unitNumber: "desc" },
    });
    const unitNumber = (last?.unitNumber ?? 0) + 1;
    const item = await prisma.stockItem.create({
      data: { materialId, unitNumber, identifier: identifier || null, notes: notes || null },
    });
    return NextResponse.json(item);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
