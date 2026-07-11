import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, serverError } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const { name, role, email, phone, dayPrice, address, postalCode, city, country, functionIds } = await req.json();
    if (!name) return badRequest("naam is verplicht");
    const person = await prisma.person.update({
      where: { id: parseInt(id) },
      data: {
        name, role, email, phone, dayPrice: Number(dayPrice) || 0,
        address, postalCode, city, country,
        functions: functionIds !== undefined
          ? { deleteMany: {}, create: (functionIds as number[]).map((fid) => ({ functionId: fid })) }
          : undefined,
      },
      include: { functions: { include: { function: true } } },
    });
    return NextResponse.json({ ...person, functions: person.functions.map((f) => f.function) });
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAuth().catch(() => null);
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    await prisma.person.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
