// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMatrixState } from "./use-matrix-state";
import type { PermissionCell } from "@/hooks/use-permissions";
import type { RoleOption } from "@/hooks/use-roles";

const ROLES: RoleOption[] = [
  { id: 1, key: "admin", label: "Admin", isSystem: true, scope: "all" },
  { id: 2, key: "viewer", label: "Viewer", isSystem: false, scope: "all" },
];

function serverFixture(): PermissionCell[] {
  // A fresh array on every call — mirrors a real TanStack Query refetch,
  // which hands back a *new* array reference even when nothing changed
  // server-side (e.g. staleTime elapsed + refetchOnWindowFocus).
  return [
    { roleId: 1, module: "gebruikers", access: "verwijderen" },
    { roleId: 2, module: "gebruikers", access: "geen" },
  ];
}

/**
 * B2a regression: permission-matrix.tsx used to mirror `permsQuery.data`
 * wholesale into local state on every new array reference, so a
 * background refetch (staleTime 30s + refetchOnWindowFocus: true,
 * globally on in query-provider.tsx) silently discarded any unsaved
 * toggle. useMatrixState fixes this by deriving server state from the
 * query data and keeping edits in a separate `dirty` overlay that only
 * a real save (`clearDirty`) or unmount can clear.
 */
describe("useMatrixState (B2a)", () => {
  it("keeps a pending edit when serverData gets a new, value-equal array reference", () => {
    const { result, rerender } = renderHook(({ data }) => useMatrixState(data), {
      initialProps: { data: serverFixture() },
    });

    expect(result.current.getAccess(2, "gebruikers")).toBe("geen");
    expect(result.current.isDirty).toBe(false);

    act(() => result.current.setAccess(2, "gebruikers", "lezen"));
    expect(result.current.getAccess(2, "gebruikers")).toBe("lezen");
    expect(result.current.isDirty).toBe(true);

    // A background refetch lands: same values, new array reference —
    // exactly what re-triggered the bug.
    rerender({ data: serverFixture() });

    expect(result.current.getAccess(2, "gebruikers")).toBe("lezen");
    expect(result.current.isDirty).toBe(true);
  });

  it("clearDirty() drops pending edits back onto server state", () => {
    const { result, rerender } = renderHook(({ data }) => useMatrixState(data), {
      initialProps: { data: serverFixture() },
    });

    act(() => result.current.setAccess(2, "gebruikers", "wijzigen"));
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.clearDirty());
    expect(result.current.isDirty).toBe(false);
    // Falls back to whatever the current serverData says (unchanged here).
    expect(result.current.getAccess(2, "gebruikers")).toBe("geen");

    // A later refetch confirming the save still doesn't count as dirty.
    const saved = serverFixture().map((c) =>
      c.roleId === 2 && c.module === "gebruikers" ? { ...c, access: "wijzigen" as const } : c,
    );
    rerender({ data: saved });
    expect(result.current.getAccess(2, "gebruikers")).toBe("wijzigen");
    expect(result.current.isDirty).toBe(false);
  });

  it("toCells() reflects pending edits for every role/module combination", () => {
    const { result } = renderHook(() => useMatrixState(serverFixture()));

    act(() => result.current.setAccess(1, "instellingen", "verwijderen"));
    const cells = result.current.toCells(ROLES);

    const cell = cells.find((c) => c.roleId === 1 && c.module === "instellingen");
    expect(cell?.access).toBe("verwijderen");
    // Untouched cells still round-trip through toCells at their default.
    const untouched = cells.find((c) => c.roleId === 2 && c.module === "projecten");
    expect(untouched?.access).toBe("geen");
  });
});
