import { describe, it, expect } from "vitest";
import { rolesHolding } from "./permission-lockout";
import type { PermissionCell } from "./permission-lockout";

describe("rolesHolding (self-lockout check, N3.2)", () => {
  it("returns roles holding the exact level", () => {
    const permissions: PermissionCell[] = [
      { roleId: 1, module: "instellingen", access: "verwijderen" },
      { roleId: 2, module: "instellingen", access: "lezen" },
    ];
    expect(rolesHolding(permissions, "instellingen", "verwijderen")).toEqual([1]);
  });

  it("returns an empty array when every role is stripped of the permission", () => {
    const permissions: PermissionCell[] = [
      { roleId: 1, module: "instellingen", access: "lezen" },
      { roleId: 2, module: "instellingen", access: "geen" },
    ];
    expect(rolesHolding(permissions, "instellingen", "verwijderen")).toEqual([]);
  });

  it("the two checks (instellingen, gebruikers) are independent — fixing one does not fix the other", () => {
    const permissions: PermissionCell[] = [
      { roleId: 1, module: "instellingen", access: "verwijderen" },
      { roleId: 1, module: "gebruikers", access: "lezen" },
    ];
    expect(rolesHolding(permissions, "instellingen", "verwijderen")).toEqual([1]);
    expect(rolesHolding(permissions, "gebruikers", "verwijderen")).toEqual([]);
  });

  it("a role satisfying via a higher level still counts (verwijderen implies itself only, but wijzigen does not satisfy verwijderen)", () => {
    const permissions: PermissionCell[] = [
      { roleId: 1, module: "instellingen", access: "wijzigen" },
    ];
    expect(rolesHolding(permissions, "instellingen", "verwijderen")).toEqual([]);
  });
});

describe("self-lockout coverage (join through User.roleId, not RolePermission alone)", () => {
  it("a role holding the permission with zero assigned users must not count as coverage", () => {
    // This is the actual server-side check in PUT /api/permissions:
    // prisma.user.count({ where: { roleId: { in: rolesHolding(...) } } }).
    // Simulated here with a fake user table to prove the shape of the
    // check is right without needing a live DB.
    const permissions: PermissionCell[] = [
      { roleId: 99, module: "instellingen", access: "verwijderen" }, // unassigned throwaway role
    ];
    const users = [{ id: 1, roleId: 1 }]; // nobody is on role 99
    const roleIds = rolesHolding(permissions, "instellingen", "verwijderen");
    const coverage = users.filter((u) => u.roleId != null && roleIds.includes(u.roleId)).length;
    expect(coverage).toBe(0);
  });

  it("a role holding the permission with at least one assigned user counts as coverage", () => {
    const permissions: PermissionCell[] = [
      { roleId: 1, module: "instellingen", access: "verwijderen" },
    ];
    const users = [{ id: 1, roleId: 1 }];
    const roleIds = rolesHolding(permissions, "instellingen", "verwijderen");
    const coverage = users.filter((u) => u.roleId != null && roleIds.includes(u.roleId)).length;
    expect(coverage).toBe(1);
  });
});
