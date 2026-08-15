import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  requireRole,
  unauthorized,
  badRequest,
  conflict,
  serverError,
  forbidden,
} from "@/lib/api-auth";
import { resolveRoleAssignment } from "@/lib/role-assignment";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  roleId: true,
  roleRel: { select: { id: true, key: true, label: true } },
  personId: true,
  createdAt: true,
} as const;

export async function GET() {
  const auth = await requireRole("ADMIN", "PLANNER", "VIEWER").catch(
    () => null,
  );
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
  const auth = await requireRole("ADMIN").catch(() => null);
  if (!auth) return forbidden();

  try {
    const { email, name, password, role, roleId } = await req.json();
    if (!email || !name || !password)
      return badRequest("email, naam en wachtwoord zijn verplicht");

    const resolved = await resolveRoleAssignment({
      role: roleId === undefined ? (role ?? "PLANNER") : undefined,
      roleId,
    });
    if (!resolved || "error" in resolved) {
      return badRequest(resolved?.error ?? "Ongeldige rol");
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return conflict("Email is al in gebruik");

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashed,
        role: resolved.role,
        roleId: resolved.roleId,
      },
      select: USER_SELECT,
    });
    return NextResponse.json(user);
  } catch (err) {
    return serverError((err as Error).message);
  }
}
