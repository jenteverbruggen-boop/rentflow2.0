import { resolveCurrentAccess } from "@/lib/api-auth";
import { satisfies } from "@/lib/modules";
import { ForbiddenPage } from "@/components/forbidden-page";
import { UsersPageContent } from "./users-page-content";

// Server Component (N4.3) — the permission check runs before any data
// fetch or client interactivity mounts, mirroring sidebar.tsx's direct
// resolveCurrentAccess() call rather than a client-side round-trip.
export default async function UsersPage() {
  const access = await resolveCurrentAccess().catch(() => null);
  const held = access?.permissions.gebruikers ?? "geen";

  if (!satisfies(held, "lezen")) {
    return <ForbiddenPage />;
  }

  return <UsersPageContent />;
}
