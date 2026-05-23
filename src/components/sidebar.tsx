import Link from "next/link";
import { LogoutButton } from "./logout-button";
import { Separator } from "./ui/separator";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/projects", label: "Projecten", icon: "📁" },
  { href: "/planning", label: "Planning", icon: "📅" },
  { href: "/people", label: "Personen", icon: "👥" },
  { href: "/materials", label: "Materialen", icon: "📦" },
  { href: "/users", label: "Gebruikers", icon: "👤" },
] as const;

export function Sidebar() {
  return (
    <aside className="w-56 bg-sidebar flex flex-col border-r border-sidebar-border shrink-0">
      <div className="p-5 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-primary">RentFlow</h1>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_LINKS.map(({ href, label, icon }) => (
          <SidebarLink key={href} href={href} label={label} icon={icon} />
        ))}
      </nav>

      <Separator className="bg-sidebar-border" />
      <div className="p-4">
        <LogoutButton />
      </div>
    </aside>
  );
}

function SidebarLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
    >
      <span>{icon}</span>
      {label}
    </Link>
  );
}
