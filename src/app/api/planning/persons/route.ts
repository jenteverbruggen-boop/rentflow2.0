import { NextRequest, NextResponse } from "next/server";
import { requireModule, forbidden, badRequest, serverError } from "@/lib/api-auth";
import { parseDateRange } from "@/lib/parse-date-range";
import { fetchPlanningPersonRows } from "@/lib/planning-person-rows";

/**
 * I3.1 — GET /api/planning/persons?from=&to=, the person-mode
 * counterpart to /api/projects's range-filtered planning shape
 * (I2.1). `from`/`to` are required here (unlike /api/projects) — there
 * is no pre-existing unfiltered caller of this brand-new endpoint to
 * preserve. `scope: own` is never denied outright — it's restricted to
 * the caller's own row inside `fetchPlanningPersonRows`.
 */
export async function GET(req: NextRequest) {
  const access = await requireModule("planning", "lezen").catch(() => null);
  if (!access) return forbidden();

  try {
    const { searchParams } = new URL(req.url);
    const range = parseDateRange(searchParams.get("from"), searchParams.get("to"));
    if (!range) return badRequest("from en to zijn verplicht en moeten een geldige periode vormen (to na from)");

    return NextResponse.json(await fetchPlanningPersonRows(access, range));
  } catch (err) {
    return serverError((err as Error).message);
  }
}
