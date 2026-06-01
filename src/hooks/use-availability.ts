import { useQuery } from "@tanstack/react-query";
import type { MaterialAvailability, PersonAvailability } from "@/types";

interface RangeQuery {
  from: string;
  to: string;
  excludePeriodId?: number;
  sameProjectId?: number;
  projectId?: number;
}

function buildQS(args: RangeQuery): string {
  const params = new URLSearchParams({ from: args.from, to: args.to });
  if (args.excludePeriodId != null) params.set("excludePeriodId", String(args.excludePeriodId));
  if (args.sameProjectId != null) params.set("sameProjectId", String(args.sameProjectId));
  if (args.projectId != null) params.set("projectId", String(args.projectId));
  return params.toString();
}

export function useMaterialAvailability(args: RangeQuery | null) {
  return useQuery({
    enabled: args != null,
    queryKey: ["available", "materials", args?.from, args?.to, args?.excludePeriodId, args?.projectId] as const,
    queryFn: async (): Promise<MaterialAvailability[]> => {
      if (!args) return [];
      const res = await fetch(`/api/materials/available?${buildQS(args)}`);
      if (!res.ok) throw new Error("Ophalen mislukt");
      return res.json();
    },
  });
}

export function usePersonAvailability(args: RangeQuery | null) {
  return useQuery({
    enabled: args != null,
    queryKey: ["available", "people", args?.from, args?.to, args?.excludePeriodId, args?.sameProjectId, args?.projectId] as const,
    queryFn: async (): Promise<PersonAvailability[]> => {
      if (!args) return [];
      const res = await fetch(`/api/people/available?${buildQS(args)}`);
      if (!res.ok) throw new Error("Ophalen mislukt");
      return res.json();
    },
  });
}
