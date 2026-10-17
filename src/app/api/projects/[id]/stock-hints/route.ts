import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, notFound, serverError } from "@/lib/api-auth";
import { scopeFilter } from "@/lib/scope-filter";
import { computeStockHints } from "@/lib/stock-hints";
import { redactStockHints } from "@/lib/stock-hints-redact";

type Params = { params: Promise<{ id: string }> };

/** Per shortage row of a project: own units free now and who holds the rest
 * (open rows), or own units free for a hired-in row. Holder names are dropped
 * for a scope-own caller. */
export async function GET(_req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "lezen").catch(() => null);
  if (!access) return forbidden();
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { ...(scopeFilter(access) ?? {}), id: parseInt(id) },
      select: { id: true },
    });
    if (!project) return notFound();
    return NextResponse.json(redactStockHints(await computeStockHints(project.id), access.scope));
  } catch (err) {
    return serverError((err as Error).message);
  }
}
