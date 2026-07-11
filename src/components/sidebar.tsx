import Link from "next/link";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { LogoutButton } from "./logout-button";
import { ThemeToggle } from "./theme-toggle";
import { Separator } from "./ui/separator";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

async function getRole(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("rentflow_token")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return (payload.role as string | undefined) ?? null;
  } catch {
    return null;
  }
}

const BASE_LINKS = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/projects", label: "Projecten", icon: "📁" },
  { href: "/planning", label: "Planning", icon: "📅" },
  { href: "/people", label: "Personen", icon: "👥" },
  { href: "/materials", label: "Materialen", icon: "📦" },
  { href: "/clients", label: "Klanten", icon: "🏢" },
  { href: "/locations", label: "Locaties", icon: "📍" },
] as const;

const ADMIN_LINKS = [
  { href: "/users", label: "Gebruikers", icon: "👤" },
  { href: "/settings", label: "Instellingen", icon: "⚙️" },
] as const;

export async function Sidebar() {
  const role = await getRole();
  const isAdmin = role === "ADMIN";

  return (
    <aside className="hidden md:flex w-56 bg-sidebar flex-col border-r border-sidebar-border shrink-0">
      <div className="p-5 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-primary">RentFlow</h1>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {BASE_LINKS.map(({ href, label, icon }) => (
          <SidebarLink key={href} href={href} label={label} icon={icon} />
        ))}
        {isAdmin &&
          ADMIN_LINKS.map(({ href, label, icon }) => (
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
