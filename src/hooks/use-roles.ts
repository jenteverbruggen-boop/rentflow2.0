import { useQuery } from "@tanstack/react-query";

export interface RoleOption {
  id: number;
  key: string;
  label: string;
}

async function fetchRoles(): Promise<RoleOption[]> {
  const res = await fetch("/api/roles");
  if (!res.ok) throw new Error("Ophalen mislukt");
  return res.json() as Promise<RoleOption[]>;
}

export function useRoles() {
  return useQuery({ queryKey: ["roles"], queryFn: fetchRoles });
}
