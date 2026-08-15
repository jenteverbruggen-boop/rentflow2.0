import { describe, it, expect } from "vitest";
import { visibleNavLinks, NAV_LINKS } from "./nav-links";

describe("visibleNavLinks (N4.2)", () => {
  it("Dashboard is always visible regardless of permissions", () => {
    const links = visibleNavLinks({});
    expect(links.some((l) => l.href === "/")).toBe(true);
  });

  it("a link tied to a module is hidden when that module is geen (or absent)", () => {
    const links = visibleNavLinks({ gebruikers: "geen" });
    expect(links.some((l) => l.href === "/users")).toBe(false);
    expect(links.some((l) => l.href === "/settings")).toBe(false);
  });

  it("a link tied to a module is visible once lezen or above is held", () => {
    const links = visibleNavLinks({ gebruikers: "lezen", instellingen: "wijzigen" });
    expect(links.some((l) => l.href === "/users")).toBe(true);
    expect(links.some((l) => l.href === "/settings")).toBe(true);
  });

  it("a fully-open (verwijderen everywhere) profile shows every link", () => {
    const full: Record<string, string> = {};
    for (const l of NAV_LINKS) if (l.module) full[l.module] = "verwijderen";
    const links = visibleNavLinks(full);
    expect(links).toHaveLength(NAV_LINKS.length);
  });

  it("includes /clients and /locations — the content gap mobile-sidebar.tsx had before both sidebars shared this list", () => {
    const full: Record<string, string> = {};
    for (const l of NAV_LINKS) if (l.module) full[l.module] = "lezen";
    const links = visibleNavLinks(full);
    expect(links.some((l) => l.href === "/clients")).toBe(true);
    expect(links.some((l) => l.href === "/locations")).toBe(true);
  });
});
