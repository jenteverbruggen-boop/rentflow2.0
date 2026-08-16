import { NextRequest, NextResponse } from "next/server";
import { requireModule, forbidden, badRequest, serverError } from "@/lib/api-auth";
import { parseDateRange } from "@/lib/parse-date-range";
import { computeStats } from "@/lib/compute-stats";

/**
 * K1.1 — GET /api/stats?from=&to=, module Cijfers:lezen. `scope: own`
 * is denied entirely regardless of the matrix
 * (own-data-scoping-design.md:192 — aggregate company revenue/
 * utilisation figures have no "my own" reading a freelancer has
 * legitimate use for, and every figure here is money-shaped).
 */
export async function GET(req: NextRequest) {
  const access = await requireModule("cijfers", "lezen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { searchParams } = new URL(req.url);
    const range = parseDateRange(searchParams.get("from"), searchParams.get("to"));
    if (!range) return badRequest("from en to zijn verplicht en moeten een geldige periode vormen (to na from)");

    return NextResponse.json(await computeStats(range));
  } catch (err) {
    return serverError((err as Error).message);
  }
}
