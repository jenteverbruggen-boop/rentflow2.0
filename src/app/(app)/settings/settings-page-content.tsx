"use client";

import { SettingsForm } from "@/components/settings-form";
import { LogoUpload } from "@/components/logo-upload";
import { RolesManager } from "@/components/roles-manager";
import { PermissionMatrix } from "@/components/permission-matrix";
import { OpenPermissionsBanner } from "@/components/open-permissions-banner";
import { CalendarFeedLinks } from "@/components/calendar-feed-links";

// Interactive content, extracted from page.tsx (N4.3) so the page itself
// can be an async Server Component that does the permission check before
// any of this ever mounts.
export function SettingsPageContent() {
  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold">Instellingen</h2>
      <SettingsForm />
      <LogoUpload />
      {/* O1.4/B2d — also kept here for convenience so an admin sees feed
          management alongside the rest of Settings. This is no longer the
          only way in: /profile (src/app/(app)/profile/page.tsx)
          gates on `planning: lezen` directly, so a planning-capable role
          with no `instellingen` access (this page's gate) can still reach
          its own "Mijn diensten" feed there. Same component, no
          duplicated logic. */}
      <CalendarFeedLinks />
      <RolesManager />
      <OpenPermissionsBanner />
      <PermissionMatrix />
    </div>
  );
}
