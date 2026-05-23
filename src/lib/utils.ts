import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ProjectStatus =
  | "concept"
  | "bevestigd"
  | "actief"
  | "afgerond"
  | "geannuleerd";

const STATUS_VARIANTS: Record<ProjectStatus, string> = {
  concept: "bg-secondary text-secondary-foreground",
  bevestigd: "bg-blue-800 text-blue-200",
  actief: "bg-green-800 text-green-200",
  afgerond: "bg-purple-800 text-purple-200",
  geannuleerd: "bg-destructive/20 text-destructive",
};

export function statusVariant(status: string): string {
  return STATUS_VARIANTS[status as ProjectStatus] ?? STATUS_VARIANTS.concept;
}
