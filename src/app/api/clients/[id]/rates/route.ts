import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireModule,
  forbidden,
  badRequest,
  conflict,
  serverError,
} from "@/lib/api-auth";
import { toNumberOrNull } from "@/lib/serialize";
import { redactMoney } from "@/lib/redact";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  functionId: z.number().int(),
  dayRate: z.coerce.number().nonnegative().nullable().optional(),
  hourRate: z.coerce.number().nonnegative().nullable().optional(),
});

function serializeRate(r: {
  id: number;
  clientId: number;
  functionId: number;
  dayRate: unknown;
  hourRate: unknown;
  function?: { id: number; name: string } | null;
}) {
  return {
    id: r.id,
    clientId: r.clientId,
    functionId: r.functionId,
    dayRate: toNumberOrNull(r.dayRate),
    hourRate: toNumberOrNull(r.hourRate),
    function: r.function ?? null,
  };
}

// L3.1 — Kosten/Facturen, not Klanten: a rate card is a commercial term,
// not a client-profile field.
export async function GET(_req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "lezen").catch(() => null);
  if (!access) return forbidden();
  // scope: own — same bucket-(c) reasoning as clients/route.ts: deny
  // outright rather than rely solely on redactMoney nulling the amounts,
  // since the rows themselves (which client negotiated a rate for which
  // function) are commercial information a freelancer has no use for.
  if (access.scope === "own") return forbidden();

  try {
    const { id } = await params;
    const rates = await prisma.clientFunctionRate.findMany({
      where: { clientId: parseInt(id) },
      include: { function: { select: { id: true, name: true } } },
      orderBy: { id: "asc" },
    });
    return NextResponse.json(rates.map((r) => redactMoney(serializeRate(r), access)));
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireModule("kosten_facturen", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  if (access.scope === "own") return forbidden();

  try {
    const { id } = await params;
    const clientId = parseInt(id);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    try {
      const rate = await prisma.clientFunctionRate.create({
        data: { clientId, ...parsed.data },
        include: { function: { select: { id: true, name: true } } },
      });
      return NextResponse.json(redactMoney(serializeRate(rate), access));
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002") {
        return conflict("Deze functie heeft al een tarief voor deze klant");
      }
      throw e;
    }
  } catch (err) {
    return serverError((err as Error).message);
  }
}
