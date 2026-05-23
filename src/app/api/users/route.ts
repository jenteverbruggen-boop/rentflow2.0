import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorized, badRequest, conflict, serverError } from "@/lib/api-auth";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} as const;

export async function GET() {
  const auth = await requireAuth().catch(() => null);
  if (!auth) return unauthorized();

  try {
    const users = await prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(users);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth().catch(() => null);
  if (!auth) return unauthorized();

  try {
    const { email, name, password, role } = await req.json();
    if (!email || !name || !password) return badRequest("email, naam en wachtwoord zijn verplicht");

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return conflict("Email is al in gebruik");

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, name, password: hashed, role: role ?? "user" },
      select: USER_SELECT,
    });
    return NextResponse.json(user);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
