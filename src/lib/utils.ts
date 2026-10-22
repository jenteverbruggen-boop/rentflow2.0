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

// Soft tints, same scheme as InvoiceStatusBadge. The hover classes repeat the
// background because the default Badge variant would otherwise hover to primary.
const STATUS_VARIANTS: Record<ProjectStatus, string> = {
  concept: "border-border bg-secondary text-secondary-foreground hover:bg-secondary",
  bevestigd: "border-blue-600/30 bg-blue-600/10 text-blue-700 hover:bg-blue-600/10 dark:text-blue-300",
  actief: "border-green-600/30 bg-green-600/10 text-green-800 hover:bg-green-600/10 dark:text-green-300",
  afgerond: "border-purple-600/30 bg-purple-600/10 text-purple-700 hover:bg-purple-600/10 dark:text-purple-300",
  geannuleerd: "border-red-600/30 bg-red-600/10 text-red-700 hover:bg-red-600/10 dark:text-red-300",
};

export function statusVariant(status: string): string {
  return STATUS_VARIANTS[status as ProjectStatus] ?? STATUS_VARIANTS.concept;
}
