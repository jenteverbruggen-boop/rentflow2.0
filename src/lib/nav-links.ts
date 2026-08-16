import { satisfies } from "@/lib/modules";
import type { AccessLevel, ModuleKey } from "@/types";

export interface NavLink {
  href: string;
  label: string;
  icon: string;
  /** Omitted for links visible to every authenticated user regardless of
   * the matrix (only Dashboard today). */
  module?: ModuleKey;
}

/**
 * The single nav-link list both sidebars render from (N4.2) — replaces
 * sidebar.tsx's BASE_LINKS/ADMIN_LINKS split and mobile-sidebar.tsx's
 * separate, shorter NAV_LINKS (which was missing /clients and /locations
 * even before considering permissions — that content gap disappears
 * automatically once both derive from this one list).
 */
export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/projects", label: "Projecten", icon: "📁", module: "projecten" },
  { href: "/planning", label: "Planning", icon: "📅", module: "planning" },
  { href: "/people", label: "Personen", icon: "👥", module: "personen" },
  { href: "/materials", label: "Materialen", icon: "📦", module: "materialen" },
  { href: "/clients", label: "Klanten", icon: "🏢", module: "klanten" },
  { href: "/locations", label: "Locaties", icon: "📍", module: "locaties" },
  // P3.4 — gated on materialen as a representative anchor (every entity
  // route re-checks its own module server-side regardless); this only
  // affects whether the shortcut is shown, not who can actually import.
  { href: "/import", label: "Importeren", icon: "⬆️", module: "materialen" },
  { href: "/facturen", label: "Facturen", icon: "🧾", module: "kosten_facturen" },
  { href: "/cijfers", label: "Cijfers", icon: "📊", module: "cijfers" },
  { href: "/users", label: "Gebruikers", icon: "👤", module: "gebruikers" },
  { href: "/settings", label: "Instellingen", icon: "⚙️", module: "instellingen" },
];

export function visibleNavLinks(
  permissions: Partial<Record<ModuleKey, AccessLevel>>,
): NavLink[] {
  return NAV_LINKS.filter((link) => {
    if (!link.module) return true;
    const held = permissions[link.module] ?? "geen";
    return satisfies(held, "lezen");
  });
}
