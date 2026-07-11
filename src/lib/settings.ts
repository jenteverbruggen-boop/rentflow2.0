import { prisma } from "@/lib/prisma";

const SETTING_KEYS = ["companyName", "companyAddress", "companyPostalCode", "companyCity", "companyPhone", "companyVat", "companyIban"] as const;
export type SettingKey = typeof SETTING_KEYS[number];

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: [...SETTING_KEYS] } }, select: { key: true, value: true } });
  const out: Record<string, string> = {};
  for (const row of rows) out[row.key] = row.value ?? "";
  return out;
}

export async function setSettings(patch: Record<string, string>): Promise<void> {
  await prisma.$transaction(
    Object.entries(patch)
      .filter(([k]) => (SETTING_KEYS as readonly string[]).includes(k))
      .map(([key, value]) => prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } }))
  );
}

export async function getLogo(): Promise<{ data: Uint8Array; mime: string } | null> {
  const row = await prisma.setting.findUnique({ where: { key: "logo" } });
  if (!row?.blob) return null;
  return { data: new Uint8Array(row.blob), mime: row.value ?? "image/png" };
}

export async function setLogo(bytes: Uint8Array<ArrayBuffer>, mime: string): Promise<void> {
  await prisma.setting.upsert({ where: { key: "logo" }, update: { value: mime, blob: bytes }, create: { key: "logo", value: mime, blob: bytes } });
}

export async function deleteLogo(): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: "logo" } });
}
