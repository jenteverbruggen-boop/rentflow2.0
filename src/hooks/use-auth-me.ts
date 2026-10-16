import { useQuery } from "@tanstack/react-query";
import type { AccessLevel, ModuleKey } from "@/types";

export interface AuthMe {
  user: { id: number; email: string; name: string; roleId: number | null };
  /** The account's saved light/dark preference. */
  theme: "light" | "dark";
  permissions: Record<ModuleKey, AccessLevel>;
  scope: "all" | "own";
  personId: number | null;
  linkedPersonMissing: boolean;
}

async function fetchMe(): Promise<AuthMe> {
  const res = await fetch("/api/auth/me");
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json() as Promise<AuthMe>;
}

export function useAuthMe() {
  return useQuery({ queryKey: ["auth-me"], queryFn: fetchMe });
}
