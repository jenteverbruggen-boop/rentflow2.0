import { NextRequest, NextResponse } from "next/server";
import { requireModule, forbidden, notFound, serverError } from "@/lib/api-auth";
import { revokeFeedToken } from "@/lib/calendar-feed";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "lezen").catch(() => null);
  if (!access) return forbidden();
  try {
    const { id } = await params;
    const revoked = await revokeFeedToken(access.id, parseInt(id, 10));
    if (!revoked) return notFound();
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
