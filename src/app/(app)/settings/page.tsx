"use client";

import { SettingsForm } from "@/components/settings-form";
import { LogoUpload } from "@/components/logo-upload";
import { RolesManager } from "@/components/roles-manager";
import { PermissionMatrix } from "@/components/permission-matrix";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold">Instellingen</h2>
      <SettingsForm />
      <LogoUpload />
      <RolesManager />
      <PermissionMatrix />
    </div>
  );
}
