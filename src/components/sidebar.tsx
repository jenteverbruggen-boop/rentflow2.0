import Link from "next/link";
import { LogoutButton } from "./logout-button";
import { ThemeToggle } from "./theme-toggle";
import { Separator } from "./ui/separator";
import { resolveCurrentAccess } from "@/lib/api-auth";
import { visibleNavLinks } from "@/lib/nav-links";

// Server Component — resolves permissions directly via
// resolveCurrentAccess() rather than a client-side fetch to /api/auth/me
// (MobileTopBar, being a Client Component, has no such option and uses
// the HTTP round-trip instead — see mobile-sidebar.tsx).
export async function Sidebar() {
  const access = await resolveCurrentAccess().catch(() => null);
  const links = visibleNavLinks(access?.permissions ?? {});

  return (
    <aside className="hidden md:flex w-56 bg-sidebar flex-col border-r border-sidebar-border shrink-0">
      <div className="p-5 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-primary">RentFlow</h1>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {links.map(({ href, label, icon }) => (
          <SidebarLink key={href} href={href} label={label} icon={icon} />
        ))}
      </nav>

      <Separator className="bg-sidebar-border" />
      <div className="p-4 space-y-1">
        <ThemeToggle className="w-full justify-start px-0 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" />
        <LogoutButton />
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
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
