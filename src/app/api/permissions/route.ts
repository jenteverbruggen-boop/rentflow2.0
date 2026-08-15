import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, forbidden, badRequest, serverError } from "@/lib/api-auth";
import { moduleKeySchema, accessLevelSchema } from "@/lib/modules";
import { rolesHolding } from "@/lib/permission-lockout";

const bodySchema = z.object({
  permissions: z.array(
    z.object({
      roleId: z.number().int().positive(),
      module: moduleKeySchema,
      access: accessLevelSchema,
    }),
  ),
});

export async function GET() {
  const auth = await requireModule("gebruikers", "lezen").catch(() => null);
  if (!auth) return forbidden();
  try {
    const permissions = await prisma.rolePermission.findMany({
      select: { roleId: true, module: true, access: true },
    });
    return NextResponse.json(permissions);
  } catch (err) {
    return serverError((err as Error).message);
  }
}

/**
 * Replaces the ENTIRE permission matrix in one call — the self-lockout
 * check needs the full proposed state, not a per-cell diff, to reason
 * about "does any role holding this permission still have a user".
 */
export async function PUT(req: NextRequest) {
  const auth = await requireModule("gebruikers", "wijzigen").catch(() => null);
  if (!auth) return forbidden();

  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    const { permissions } = parsed.data;

    // Two independent self-lockout checks — a save that fixes one while
    // breaking the other must still be refused. "Join through User.roleId"
    // means: which roles hold this permission, then are any actual users
    // assigned to one of those roles — not merely "does a RolePermission
    // row exist" (an unassigned throwaway role holding the permission
    // must not count as coverage).
    const rolesWithInstellingenDelete = rolesHolding(permissions, "instellingen", "verwijderen");
    const rolesWithGebruikersDelete = rolesHolding(permissions, "gebruikers", "verwijderen");

    const [instellingenCoverage, gebruikersCoverage] = await Promise.all([
      prisma.user.count({ where: { roleId: { in: rolesWithInstellingenDelete } } }),
      prisma.user.count({ where: { roleId: { in: rolesWithGebruikersDelete } } }),
    ]);

    if (instellingenCoverage === 0) {
      return badRequest(
        "Deze wijziging zou betekenen dat geen enkele bereikbare gebruiker nog Instellingen: verwijderen heeft. Kies minstens één rol met een toegewezen gebruiker die dit behoudt.",
      );
    }
    if (gebruikersCoverage === 0) {
      return badRequest(
        "Deze wijziging zou betekenen dat geen enkele bereikbare gebruiker nog Gebruikers: verwijderen heeft — daarmee kan niemand nog rollen herstellen. Kies minstens één rol met een toegewezen gebruiker die dit behoudt.",
      );
    }

    // Atomic — a partial write (some rows updated, then a crash) would
    // leave the matrix in a mixed state, worse than rejecting the save.
    await prisma.$transaction(async (tx) => {
      const roleIds = [...new Set(permissions.map((p) => p.roleId))];
      await tx.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
      await tx.rolePermission.createMany({ data: permissions });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError((err as Error).message);
  }
}
