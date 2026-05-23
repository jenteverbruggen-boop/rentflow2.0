import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  unauthorized,
  badRequest,
  notFound,
  serverError,
} from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth().catch(() => null);
  if (!auth) return unauthorized();

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    const body = await req.json();

    const data: { role?: string; password?: string } = {};
    if (body.role !== undefined) data.role = body.role;
    if (body.password) {
      if (typeof body.password !== "string" || body.password.length < 8) {
        return badRequest("Wachtwoord moet minimaal 8 tekens zijn");
      }
      data.password = await bcrypt.hash(body.password, 10);
    }

    if (Object.keys(data).length === 0) return badRequest("Geen wijzigingen opgegeven");

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) return notFound();

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: USER_SELECT,
    });
    return NextResponse.json(updated);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth().catch(() => null);
  if (!auth) return unauthorized();

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);

    if (auth.id === userId) {
      return badRequest("Je kunt jezelf niet verwijderen");
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) return notFound();

    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
