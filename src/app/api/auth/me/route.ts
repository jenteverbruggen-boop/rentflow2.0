import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, resolveCurrentAccess, unauthorized, serverError } from "@/lib/api-auth";
import { MODULES } from "@/lib/modules";
import type { AccessLevel } from "@/types";

// The discovery endpoint a client calls *before* knowing what it's
// allowed to see — requires authentication only, never a specific module
// (that would be circular). On N2.5's exemption list.
export async function GET() {
  const payload = await requireAuth().catch(() => null);
  if (!payload) return unauthorized();

  try {
    const access = await resolveCurrentAccess();
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, roleId: true },
    });

    // Full ten-module map, not the partial one requireModule works with
    // internally — the client shouldn't have to know that an absent key
    // means "geen".
    const permissions: Record<string, AccessLevel> = {};
    for (const m of MODULES) {
      permissions[m.key] = access.permissions[m.key] ?? "geen";
    }

    return NextResponse.json({
      user,
      permissions,
      scope: access.scope,
      personId: access.personId,
      // Real computation lands in N5.1 (scope === "own" && personId === null);
      // false for everyone until scope:own roles exist.
      linkedPersonMissing: access.scope === "own" && access.personId === null,
    });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
