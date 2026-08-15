import { prisma } from "@/lib/prisma";

interface RoleAssignmentOk {
  roleId: number;
}

interface RoleAssignmentError {
  error: string;
}

/**
 * Validate a `roleId` assignment against the Role table.
 *
 * N4.3: the legacy `role` string column is gone, and with it the
 * restriction that only system roles (isSystem = true) could be
 * assigned to a user (N1.4) — that existed only to keep the legacy
 * column and roleId in sync while both existed. Any role, system or
 * custom, can now be assigned directly by id.
 *
 * Returns null when roleId is not present in the input (caller should
 * leave roleId untouched — this is the PATCH "no change" case).
 */
export async function resolveRoleAssignment(input: {
  roleId?: unknown;
}): Promise<RoleAssignmentOk | RoleAssignmentError | null> {
  if (input.roleId === undefined) return null;
  const roleId = Number(input.roleId);
  if (!Number.isInteger(roleId)) {
    return { error: "roleId is ongeldig" };
  }
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return { error: "roleId bestaat niet" };
  return { roleId: role.id };
}
