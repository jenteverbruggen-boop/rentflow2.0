import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A lucide icon sized to sit inside a line of text — the replacement for
 * the emoji glyphs (which render differently per OS and can't be themed). */
export function InlineIcon({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return <Icon className={cn("inline h-3.5 w-3.5 -mt-0.5 shrink-0", className)} aria-hidden />;
}
