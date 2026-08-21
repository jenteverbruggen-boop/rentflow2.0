import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireModule, badRequest, notFound, conflict, serverError, forbidden } from "@/lib/api-auth";
import { resolveRoleAssignment } from "@/lib/role-assignment";
import { resolvePersonLink } from "@/lib/person-link";
import { revokeCompanyFeedForUser } from "@/lib/calendar-feed";

type Params = { params: Promise<{ id: string }> };

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  roleId: true,
  roleRel: { select: { id: true, key: true, label: true, scope: true } },
  personId: true,
  person: { select: { name: true } },
  createdAt: true,
} as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireModule("gebruikers", "wijzigen").catch(() => null);
  if (!auth) return forbidden();

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    const body = await req.json();

    // No self-promotion allowed.
    if (body.roleId !== undefined && auth.id === userId) {
      return badRequest("Je kunt je eigen rol niet wijzigen");
    }

    const data: {
      roleId?: number;
      password?: string;
      personId?: number | null;
    } = {};
    if (body.roleId !== undefined) {
      const resolved = await resolveRoleAssignment({ roleId: body.roleId });
      if (resolved && "error" in resolved) return badRequest(resolved.error);
      if (resolved) {
        data.roleId = resolved.roleId;
      }
    }
    if (body.personId !== undefined) {
      const resolvedPerson = await resolvePersonLink({ personId: body.personId });
      if (resolvedPerson && "error" in resolvedPerson) return badRequest(resolvedPerson.error);
      if (resolvedPerson) {
        data.personId = resolvedPerson.personId;
      }
    }
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
      // O1.3 — a role reassignment can invalidate this user's eligibility
      // for the company calendar feed; a static URL token can't be
      // re-checked on every poll, so revoke it here instead.
      if (data.roleId !== undefined) await revokeCompanyFeedForUser(userId);
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
  const auth = await requireModule("gebruikers", "verwijderen").catch(() => null);
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
