import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, serverError } from "@/lib/api-auth";

export async function GET() {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const people = await prisma.person.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(people);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { name, role, email, phone } = await req.json();
    if (!name) return badRequest("naam is verplicht");
    const person = await prisma.person.create({ data: { name, role, email, phone } });
    return NextResponse.json(person);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
