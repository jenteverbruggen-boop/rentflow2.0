import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api-auth";

type Params = { params: Promise<{ id: string; bundleId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "verwijderen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { bundleId } = await params;
    const booking = await prisma.periodBundleBooking.findUnique({
      where: { id: parseInt(bundleId) },
    });
    if (!booking) return notFound();
    await prisma.periodBundleBooking.delete({
      where: { id: parseInt(bundleId) },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
