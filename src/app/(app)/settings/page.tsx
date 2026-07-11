"use client";

import { SettingsForm } from "@/components/settings-form";
import { LogoUpload } from "@/components/logo-upload";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">Instellingen</h2>
      <SettingsForm />
      <LogoUpload />
    </div>
  );
}
