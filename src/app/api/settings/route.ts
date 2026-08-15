import { NextRequest, NextResponse } from "next/server";
import {
  requireModule,
  forbidden,
  serverError,
} from "@/lib/api-auth";
import { getSettings, setSettings } from "@/lib/settings";

export async function GET() {
  const user = await requireModule("instellingen", "lezen").catch(() => null);
  if (!user) return forbidden();
  try {
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireModule("instellingen", "wijzigen").catch(() => null);
  if (!auth) return forbidden();
  try {
    const body = await req.json();
    await setSettings(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
