import { prisma } from "@/lib/prisma";

interface RoleAssignmentOk {
  role: string;
  roleId: number;
}

interface RoleAssignmentError {
  error: string;
}

/**
 * Validate a `role` (legacy string) or `roleId` (new column) assignment and
 * resolve both to a consistent pair, looked up from the Role table — the
 * single place role/roleId are kept in sync while both columns exist.
 *
 * Decided rule (N1.4): while User.role still exists, roleId may only point
 * at a system role (isSystem = true). Assigning a custom role is rejected —
 * mapping it onto "the nearest system string" was rejected too, since that
 * silently grants whatever that system role can do. This restriction lifts
 * in N4.3 once the legacy column is gone.
 *
 * Returns null when neither field is present in the input (caller should
 * leave role/roleId untouched — this is the PATCH "no change" case).
 */
export async function resolveRoleAssignment(input: {
  role?: unknown;
  roleId?: unknown;
}): Promise<RoleAssignmentOk | RoleAssignmentError | null> {
  if (input.roleId !== undefined) {
    const roleId = Number(input.roleId);
    if (!Number.isInteger(roleId)) {
      return { error: "roleId is ongeldig" };
    }
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return { error: "roleId bestaat niet" };
    if (!role.isSystem) {
      return {
        error:
          "Aangepaste rollen kunnen nog niet aan gebruikers worden toegewezen — dit wordt beschikbaar zodra de oude rol-kolom is verwijderd.",
      };
    }
    return { role: role.key, roleId: role.id };
  }
  if (input.role !== undefined) {
    const key = String(input.role).toUpperCase();
    const role = await prisma.role.findUnique({ where: { key } });
    if (!role || !role.isSystem) {
      return { error: "Ongeldige rol" };
    }
    return { role: role.key, roleId: role.id };
  }
  return null;
}
