import { describe, it, expect } from "vitest";
import { rolesHolding } from "./permission-lockout";
import type { PermissionCell, RoleScope } from "./permission-lockout";

const ALL_SCOPE_ROLES: RoleScope[] = [
  { id: 1, scope: "all" },
  { id: 2, scope: "all" },
];

describe("rolesHolding (self-lockout check, N3.2)", () => {
  it("returns roles holding the exact level", () => {
    const permissions: PermissionCell[] = [
      { roleId: 1, module: "instellingen", access: "verwijderen" },
      { roleId: 2, module: "instellingen", access: "lezen" },
    ];
    expect(rolesHolding(permissions, ALL_SCOPE_ROLES, "instellingen", "verwijderen")).toEqual([1]);
  });

  it("returns an empty array when every role is stripped of the permission", () => {
    const permissions: PermissionCell[] = [
      { roleId: 1, module: "instellingen", access: "lezen" },
      { roleId: 2, module: "instellingen", access: "geen" },
    ];
    expect(rolesHolding(permissions, ALL_SCOPE_ROLES, "instellingen", "verwijderen")).toEqual([]);
  });

  it("the two checks (instellingen, gebruikers) are independent — fixing one does not fix the other", () => {
    const permissions: PermissionCell[] = [
      { roleId: 1, module: "instellingen", access: "verwijderen" },
      { roleId: 1, module: "gebruikers", access: "lezen" },
    ];
    expect(rolesHolding(permissions, ALL_SCOPE_ROLES, "instellingen", "verwijderen")).toEqual([1]);
    expect(rolesHolding(permissions, ALL_SCOPE_ROLES, "gebruikers", "verwijderen")).toEqual([]);
  });

  it("a role satisfying via a higher level still counts (verwijderen implies itself only, but wijzigen does not satisfy verwijderen)", () => {
    const permissions: PermissionCell[] = [
      { roleId: 1, module: "instellingen", access: "wijzigen" },
    ];
    expect(rolesHolding(permissions, ALL_SCOPE_ROLES, "instellingen", "verwijderen")).toEqual([]);
  });
});

describe("rolesHolding — scope-aware coverage (B2b)", () => {
  // requireModule (api-auth.ts) unconditionally vetoes any non-"lezen"
  // action for a scope: "own" role. A matrix cell granting such a role
  // "verwijderen" is therefore a dead letter and must never count as
  // coverage for the self-lockout check, or the last real holder of a
  // delete permission could be an own-scope (e.g. freelancer) role —
  // passing validation while creating a real, unrecoverable lockout.
  it("excludes a scope: own role from coverage for verwijderen", () => {
    const roles: RoleScope[] = [
      { id: 1, scope: "own" },
      { id: 2, scope: "all" },
    ];
    const permissions: PermissionCell[] = [
      { roleId: 1, module: "instellingen", access: "verwijderen" },
      { roleId: 2, module: "instellingen", access: "geen" },
    ];
    expect(rolesHolding(permissions, roles, "instellingen", "verwijderen")).toEqual([]);
  });

  it("excludes a scope: own role from coverage for wijzigen too — not just verwijderen", () => {
    const roles: RoleScope[] = [{ id: 1, scope: "own" }];
    const permissions: PermissionCell[] = [
      { roleId: 1, module: "gebruikers", access: "verwijderen" },
    ];
    expect(rolesHolding(permissions, roles, "gebruikers", "wijzigen")).toEqual([]);
  });

  it("still counts a scope: own role for lezen — reading is never vetoed for own scope", () => {
    const roles: RoleScope[] = [{ id: 1, scope: "own" }];
    const permissions: PermissionCell[] = [{ roleId: 1, module: "instellingen", access: "lezen" }];
    expect(rolesHolding(permissions, roles, "instellingen", "lezen")).toEqual([1]);
  });

  it("a role missing from the roles list (e.g. stale data) is not treated as own-scope", () => {
    const permissions: PermissionCell[] = [
      { roleId: 99, module: "instellingen", access: "verwijderen" },
    ];
    expect(rolesHolding(permissions, [], "instellingen", "verwijderen")).toEqual([99]);
  });

  it("the live-prod scenario: an all-scope role plus a freelancer (own-scope) role both hold verwijderen — coverage survives on the all-scope role alone", () => {
    const roles: RoleScope[] = [
      { id: 1, scope: "all" }, // ADMIN
      { id: 4, scope: "own" }, // FREELANCER
    ];
    const permissions: PermissionCell[] = [
      { roleId: 1, module: "gebruikers", access: "verwijderen" },
      { roleId: 4, module: "gebruikers", access: "verwijderen" },
    ];
    expect(rolesHolding(permissions, roles, "gebruikers", "verwijderen")).toEqual([1]);
  });

  it("the lockout case: if the ONLY role holding verwijderen is own-scope, coverage is zero", () => {
    const roles: RoleScope[] = [{ id: 4, scope: "own" }];
    const permissions: PermissionCell[] = [
      { roleId: 4, module: "gebruikers", access: "verwijderen" },
    ];
    expect(rolesHolding(permissions, roles, "gebruikers", "verwijderen")).toEqual([]);
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
    const roles: RoleScope[] = [{ id: 99, scope: "all" }];
    const users = [{ id: 1, roleId: 1 }]; // nobody is on role 99
    const roleIds = rolesHolding(permissions, roles, "instellingen", "verwijderen");
    const coverage = users.filter((u) => u.roleId != null && roleIds.includes(u.roleId)).length;
    expect(coverage).toBe(0);
  });

  it("a role holding the permission with at least one assigned user counts as coverage", () => {
    const permissions: PermissionCell[] = [
      { roleId: 1, module: "instellingen", access: "verwijderen" },
    ];
    const roles: RoleScope[] = [{ id: 1, scope: "all" }];
    const users = [{ id: 1, roleId: 1 }];
    const roleIds = rolesHolding(permissions, roles, "instellingen", "verwijderen");
    const coverage = users.filter((u) => u.roleId != null && roleIds.includes(u.roleId)).length;
    expect(coverage).toBe(1);
  });
});
