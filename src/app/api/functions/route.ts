import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, serverError } from "@/lib/api-auth";

const schema = z.object({ name: z.string().min(1, "Naam is verplicht") });

export async function GET() {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const functions = await prisma.function.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(functions);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    const fn = await prisma.function.create({ data: parsed.data });
    return NextResponse.json(fn);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
