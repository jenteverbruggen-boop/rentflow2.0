import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, resolveCurrentAccess, unauthorized, badRequest, serverError } from "@/lib/api-auth";
import { setUserTheme, getUserTheme } from "@/lib/user-theme";
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
    const theme = await getUserTheme(payload.id);

    // Full ten-module map, not the partial one requireModule works with
    // internally — the client shouldn't have to know that an absent key
    // means "geen".
    const permissions: Record<string, AccessLevel> = {};
    for (const m of MODULES) {
      permissions[m.key] = access.permissions[m.key] ?? "geen";
    }

    return NextResponse.json({
      user,
      theme,
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

const patchSchema = z.object({ theme: z.enum(["light", "dark"]) });

/** PATCH /api/auth/me { theme } — the caller's own display preference, stored
 * on the account so it follows them to every device. Only ever touches the
 * signed-in user's own row, so authentication is all it needs (same
 * exemption as GET above). */
export async function PATCH(req: NextRequest) {
  const payload = await requireAuth().catch(() => null);
  if (!payload) return unauthorized();
  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("theme moet light of dark zijn");
    return NextResponse.json({ theme: await setUserTheme(payload.id, parsed.data.theme) });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
