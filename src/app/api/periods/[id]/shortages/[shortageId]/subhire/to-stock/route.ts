import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule, forbidden, badRequest, notFound, conflict, serverError } from "@/lib/api-auth";
import { takeOwnStockForHire } from "@/lib/subhire-to-stock";
import { SubhireError } from "@/lib/subhire";

type Params = { params: Promise<{ id: string; shortageId: string }> };

const schema = z.object({ quantity: z.number().int().min(1) });

/** POST — switch (part of) a hired-in row to own stock that is free. */
export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "wijzigen").catch(() => null);
  if (!access) return forbidden();
  try {
    const { id, shortageId } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
    return NextResponse.json(await takeOwnStockForHire(parseInt(id), parseInt(shortageId), parsed.data.quantity));
  } catch (err) {
    if (err instanceof SubhireError) {
      if (err.code === "NOT_FOUND") return notFound();
      if (err.code === "BAD_QUANTITY") return badRequest(err.message);
      return conflict(err.message);
    }
    return serverError((err as Error).message);
  }
}
