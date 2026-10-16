import { satisfies } from "@/lib/modules";
import type { AccessLevel, ModuleKey } from "@/types";

export type NavIconName =
  | "home" | "folder" | "calendar" | "link" | "notes" | "people" | "package"
  | "building" | "pin" | "upload" | "receipt" | "chart" | "user" | "settings";

export type NavGroup = "Werk" | "Gegevens" | "Financieel" | "Beheer";

export interface NavLink {
  href: string;
  label: string;
  /** Key into the lucide map in nav-link-list.tsx (strings, not components,
   * so the list can cross the Server→Client Component boundary). */
  icon: NavIconName;
  /** Section heading in the sidebar; Dashboard has none. */
  group?: NavGroup;
  /** Omitted for links visible to every authenticated user regardless of
   * the matrix (only Dashboard today). */
  module?: ModuleKey;
  /** Renders a count of pending user↔person link suggestions. */
  badge?: "person-link";
}

/**
 * The single nav-link list both sidebars render from (N4.2) — replaces
 * sidebar.tsx's BASE_LINKS/ADMIN_LINKS split and mobile-sidebar.tsx's
 * separate, shorter NAV_LINKS (which was missing /clients and /locations
 * even before considering permissions — that content gap disappears
 * automatically once both derive from this one list).
 */
export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Dashboard", icon: "home" },
  { href: "/projects", group: "Werk", label: "Projecten", icon: "folder", module: "projecten" },
  { href: "/planning", group: "Werk", label: "Planning", icon: "calendar", module: "planning" },
  // O1.4/B2d — own reachable surface for agenda-feed self-service, gated on
  // the same `planning: lezen` the component itself requires (not
  // `instellingen`, which would hide it from a planning-capable role with
  // no settings access — see calendar-feed-links.tsx).
  { href: "/agenda-feeds", group: "Werk", label: "Agenda-feeds", icon: "link", module: "planning" },
  { href: "/notes", group: "Werk", label: "Notities", icon: "notes", module: "notities" },
  { href: "/people", group: "Gegevens", label: "Personen", icon: "people", module: "personen", badge: "person-link" },
  { href: "/materials", group: "Gegevens", label: "Materialen", icon: "package", module: "materialen" },
  { href: "/clients", group: "Gegevens", label: "Klanten", icon: "building", module: "klanten" },
  { href: "/locations", group: "Gegevens", label: "Locaties", icon: "pin", module: "locaties" },
  // P3.4 — gated on materialen as a representative anchor (every entity
  // route re-checks its own module server-side regardless); this only
  // affects whether the shortcut is shown, not who can actually import.
  { href: "/import", group: "Gegevens", label: "Importeren", icon: "upload", module: "materialen" },
  { href: "/facturen", group: "Financieel", label: "Facturen", icon: "receipt", module: "kosten_facturen" },
  { href: "/cijfers", group: "Financieel", label: "Cijfers", icon: "chart", module: "cijfers" },
  { href: "/users", group: "Beheer", label: "Gebruikers", icon: "user", module: "gebruikers", badge: "person-link" },
  { href: "/settings", group: "Beheer", label: "Instellingen", icon: "settings", module: "instellingen" },
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
