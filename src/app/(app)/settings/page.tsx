import { resolveCurrentAccess } from "@/lib/api-auth";
import { satisfies } from "@/lib/modules";
import { ForbiddenPage } from "@/components/forbidden-page";
import { SettingsPageContent } from "./settings-page-content";

// Server Component (N4.3) — the permission check runs before any data
// fetch or client interactivity mounts, mirroring sidebar.tsx's direct
// resolveCurrentAccess() call rather than a client-side round-trip.
export default async function SettingsPage() {
  const access = await resolveCurrentAccess().catch(() => null);
  const held = access?.permissions.instellingen ?? "geen";

  if (!satisfies(held, "lezen")) {
    return <ForbiddenPage />;
  }

  return <SettingsPageContent />;
}
