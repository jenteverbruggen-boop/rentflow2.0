import { describe, it, expect } from "vitest";
import {
  recommendedLevel,
  exceedsBaseline,
  diffAgainstRecommended,
  buildRecommendedMatrix,
} from "./recommended-permissions";
import { MODULES } from "./modules";
import type { PermissionCell } from "./permission-lockout";

const ROLES = [
  { id: 1, key: "ADMIN", isSystem: true, label: "Admin" },
  { id: 2, key: "PLANNER", isSystem: true, label: "Planner" },
  { id: 3, key: "VIEWER", isSystem: true, label: "Viewer" },
];

function fullyOpen(): PermissionCell[] {
  const cells: PermissionCell[] = [];
  for (const r of ROLES) {
    for (const m of MODULES) cells.push({ roleId: r.id, module: m.key, access: "verwijderen" });
  }
  return cells;
}

describe("recommendedLevel", () => {
  it("ADMIN is verwijderen everywhere", () => {
    expect(recommendedLevel("ADMIN", "projecten")).toBe("verwijderen");
    expect(recommendedLevel("ADMIN", "kosten_facturen")).toBe("verwijderen");
  });

  it("VIEWER is lezen everywhere", () => {
    expect(recommendedLevel("VIEWER", "projecten")).toBe("lezen");
    expect(recommendedLevel("VIEWER", "gebruikers")).toBe("lezen");
  });

  it("PLANNER is wijzigen except kosten_facturen/gebruikers/instellingen", () => {
    expect(recommendedLevel("PLANNER", "projecten")).toBe("wijzigen");
    expect(recommendedLevel("PLANNER", "kosten_facturen")).toBe("geen");
    expect(recommendedLevel("PLANNER", "gebruikers")).toBe("geen");
    expect(recommendedLevel("PLANNER", "instellingen")).toBe("geen");
  });

  it("returns null for a custom role — no principled default", () => {
    expect(recommendedLevel("FREELANCER", "projecten")).toBeNull();
  });
});

describe("exceedsBaseline", () => {
  it("the fully-open seed (C1) exceeds the baseline", () => {
    expect(exceedsBaseline(fullyOpen(), ROLES)).toBe(true);
  });

  it("a role configured MORE restrictively than the baseline does not trigger the banner", () => {
    const permissions: PermissionCell[] = MODULES.map((m) => ({
      roleId: 3, // VIEWER, recommended = lezen everywhere
      module: m.key,
      access: "geen", // stricter than recommended, not looser
    }));
    expect(exceedsBaseline(permissions, [ROLES[2]])).toBe(false);
  });

  it("returns false once every system role exactly matches its recommendation", () => {
    const permissions: PermissionCell[] = [];
    for (const r of ROLES) {
      for (const m of MODULES) {
        permissions.push({ roleId: r.id, module: m.key, access: recommendedLevel(r.key, m.key)! });
      }
    }
    expect(exceedsBaseline(permissions, ROLES)).toBe(false);
  });

  it("ignores custom roles entirely", () => {
    const custom = { id: 99, key: "FREELANCER", isSystem: false, label: "Freelancer" };
    const permissions: PermissionCell[] = MODULES.map((m) => ({
      roleId: 99,
      module: m.key,
      access: "verwijderen",
    }));
    expect(exceedsBaseline(permissions, [custom])).toBe(false);
  });
});

describe("diffAgainstRecommended", () => {
  it("lists only the cells that actually change, for system roles only", () => {
    const rows = diffAgainstRecommended(fullyOpen(), ROLES);
    // Every system-role cell is "verwijderen" today; VIEWER's and
    // PLANNER's recommendations differ from that, ADMIN's does not.
    expect(rows.some((r) => r.roleLabel === "Viewer")).toBe(true);
    expect(rows.some((r) => r.roleLabel === "Planner")).toBe(true);
    expect(rows.some((r) => r.roleLabel === "Admin")).toBe(false);
  });
});

describe("buildRecommendedMatrix", () => {
  it("replaces system-role cells, leaves custom-role cells untouched", () => {
    const custom = { id: 99, key: "FREELANCER", isSystem: false, label: "Freelancer" };
    const permissions: PermissionCell[] = [
      ...fullyOpen(),
      { roleId: 99, module: "projecten", access: "verwijderen" },
    ];
    const result = buildRecommendedMatrix(permissions, [...ROLES, custom]);
    const customCell = result.find((c) => c.roleId === 99);
    expect(customCell?.access).toBe("verwijderen"); // untouched
    const viewerProjecten = result.find((c) => c.roleId === 3 && c.module === "projecten");
    expect(viewerProjecten?.access).toBe("lezen"); // replaced
  });
});
