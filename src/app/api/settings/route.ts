import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized, serverError } from "@/lib/api-auth";
import { getSettings, setSettings } from "@/lib/settings";

export async function GET() {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function PUT(req: NextRequest) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const body = await req.json();
    await setSettings(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
