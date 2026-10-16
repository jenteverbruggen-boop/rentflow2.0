import { NextResponse } from "next/server";
import { requireAuth, unauthorized, serverError } from "@/lib/api-auth";
import { getSettings, PRINT_SETTING_KEYS } from "@/lib/settings";

/** GET /api/settings/company — the company block + payment details that
 * print documents need. Any signed-in user may read it: a role without
 * `instellingen` access must still get a complete invoice/pakbon header. */
export async function GET() {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    return NextResponse.json(await getSettings(PRINT_SETTING_KEYS));
  } catch (err) {
    return serverError((err as Error).message);
  }
}
