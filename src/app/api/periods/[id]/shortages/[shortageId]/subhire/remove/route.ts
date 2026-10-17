import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModule, forbidden, badRequest, notFound, conflict, serverError } from "@/lib/api-auth";
import { removeHiredUnits } from "@/lib/subhire-remove";
import { SubhireError } from "@/lib/subhire";

type Params = { params: Promise<{ id: string; shortageId: string }> };

const schema = z.object({ count: z.union([z.number().int().min(1), z.literal("all")]) });

/** POST — remove (part of) a hired-in row, in any project status. */
export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireModule("planning", "verwijderen").catch(() => null);
  if (!access) return forbidden();
  try {
    const { id, shortageId } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
    const result = await removeHiredUnits(parseInt(id), parseInt(shortageId), parsed.data.count);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SubhireError) {
      if (err.code === "NOT_FOUND") return notFound();
      if (err.code === "BAD_QUANTITY") return badRequest(err.message);
      return conflict(err.message);
    }
    return serverError((err as Error).message);
  }
}
