import { LogoutButton } from "./logout-button";
import { Separator } from "./ui/separator";
import { resolveCurrentAccess } from "@/lib/api-auth";
import { visibleNavLinks } from "@/lib/nav-links";
import { NavLinkList } from "./nav-link-list";
import { ProfileLink } from "./profile-link";

// Server Component — resolves permissions directly via
// resolveCurrentAccess() rather than a client-side fetch to /api/auth/me
// (MobileTopBar, being a Client Component, has no such option and uses
// the HTTP round-trip instead — see mobile-sidebar.tsx).
export async function Sidebar() {
  const access = await resolveCurrentAccess().catch(() => null);
  const links = visibleNavLinks(access?.permissions ?? {});

  return (
    <aside className="hidden lg:flex w-56 bg-sidebar flex-col border-r border-sidebar-border shrink-0">
      <div className="p-4 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-primary">RentFlow</h1>
      </div>

      <NavLinkList links={links} />

      <Separator className="bg-sidebar-border" />
      <div className="p-3 space-y-1">
        <ProfileLink />
        <LogoutButton />
      </div>
    </aside>
  );
}
