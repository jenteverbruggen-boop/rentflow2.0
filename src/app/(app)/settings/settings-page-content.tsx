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
      {/* O1.4 — lives on the Settings page per the brief's own
          "feat(settings)" framing; note this means it inherits the
          same instellingen: lezen gate as the rest of this page,
          even though feed management is conceptually self-service
          for any planning-capable role, not settings-admin-only. */}
      <CalendarFeedLinks />
      <RolesManager />
      <OpenPermissionsBanner />
      <PermissionMatrix />
    </div>
  );
}
