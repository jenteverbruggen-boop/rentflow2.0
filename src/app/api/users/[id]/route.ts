import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole, badRequest, notFound, conflict, serverError, forbidden } from "@/lib/api-auth";
import { resolveRoleAssignment } from "@/lib/role-assignment";

type Params = { params: Promise<{ id: string }> };

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

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireRole("ADMIN").catch(() => null);
  if (!auth) return forbidden();

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    const body = await req.json();

    // No self-promotion allowed — covers both the legacy role string and
    // the new roleId column, so an admin can't bypass this via either field.
    if (
      (body.role !== undefined || body.roleId !== undefined) &&
      auth.id === userId
    ) {
      return badRequest("Je kunt je eigen rol niet wijzigen");
    }

    const data: {
      role?: string;
      roleId?: number;
      password?: string;
      personId?: number | null;
    } = {};
    if (body.role !== undefined || body.roleId !== undefined) {
      const resolved = await resolveRoleAssignment({
        role: body.role,
        roleId: body.roleId,
      });
      if (resolved && "error" in resolved) return badRequest(resolved.error);
      if (resolved) {
        data.role = resolved.role;
        data.roleId = resolved.roleId;
      }
    }
    if (body.personId !== undefined) data.personId = body.personId ?? null;
    if (body.password) {
      if (typeof body.password !== "string" || body.password.length < 8) {
        return badRequest("Wachtwoord moet minimaal 8 tekens zijn");
      }
      data.password = await bcrypt.hash(body.password, 10);
    }

    if (Object.keys(data).length === 0) return badRequest("Geen wijzigingen opgegeven");

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) return notFound();

    try {
      const updated = await prisma.user.update({ where: { id: userId }, data, select: USER_SELECT });
      return NextResponse.json(updated);
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002") return conflict("Deze persoon is al gekoppeld aan een account");
      throw e;
    }
  } catch (err) {
    return serverError((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireRole("ADMIN").catch(() => null);
  if (!auth) return forbidden();

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (auth.id === userId) return badRequest("Je kunt jezelf niet verwijderen");
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) return notFound();
    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
