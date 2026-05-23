import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, conflict, serverError } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { projectId, materialId, quantity, startDate, endDate } = await req.json();
    if (!projectId || !materialId || !quantity || !startDate || !endDate)
      return badRequest("projectId, materialId, quantity, startDate en endDate zijn verplicht");

    const existing = await prisma.projectMaterial.aggregate({
      where: {
        materialId: parseInt(materialId),
        NOT: { projectId: parseInt(projectId) },
        project: {
          AND: [
            { startDate: { lte: new Date(endDate) } },
            { endDate: { gte: new Date(startDate) } },
          ],
        },
      },
      _sum: { quantity: true },
    });

    const material = await prisma.material.findUnique({ where: { id: parseInt(materialId) } });
    if (!material) return badRequest("Materiaal niet gevonden");

    const alreadyBooked = existing._sum.quantity ?? 0;
    if (alreadyBooked + parseInt(quantity) > material.totalStock) {
      return conflict(
        `Niet genoeg voorraad. Totaal: ${material.totalStock}, al geboekt: ${alreadyBooked}, beschikbaar: ${material.totalStock - alreadyBooked}`
      );
    }

    const booking = await prisma.projectMaterial.create({
      data: {
        projectId: parseInt(projectId),
        materialId: parseInt(materialId),
        quantity: parseInt(quantity),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
      include: { material: true },
    });
    return NextResponse.json(booking);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
