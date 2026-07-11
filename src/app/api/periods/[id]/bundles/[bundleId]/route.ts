import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  unauthorized,
  notFound,
  serverError,
} from "@/lib/api-auth";

type Params = { params: Promise<{ id: string; bundleId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

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
