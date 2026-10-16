"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, CalendarDays, FolderKanban, LayoutDashboard, Link2, MapPin, NotebookPen,
  FileText, Package, Truck, Receipt, Settings, Upload, User, Users, BarChart3, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavSuggestionBadge } from "@/components/nav-suggestion-badge";
import type { NavIconName, NavLink } from "@/lib/nav-links";

const ICONS: Record<NavIconName, LucideIcon> = {
  home: LayoutDashboard, folder: FolderKanban, calendar: CalendarDays, link: Link2,
  notes: NotebookPen, people: Users, package: Package, building: Building2, truck: Truck, pin: MapPin,
  upload: Upload, receipt: Receipt, quote: FileText, chart: BarChart3, user: User, settings: Settings,
};

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** The one nav renderer for the desktop sidebar and the mobile sheet:
 * grouped sections, lucide icons and a highlighted current page. */
export function NavLinkList({ links, onNavigate }: { links: NavLink[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto p-3" aria-label="Hoofdmenu">
      {links.map(({ href, label, icon, group, badge }, i) => {
        const Icon = ICONS[icon];
        const active = isActive(pathname, href);
        const heading = group && group !== links[i - 1]?.group ? group : null;
        return (
          <div key={href}>
            {heading && (
              <p className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {heading}
              </p>
            )}
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} aria-hidden />
              {label}
              {badge === "person-link" && <NavSuggestionBadge />}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
