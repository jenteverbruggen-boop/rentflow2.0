"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Footer entry to /profile — account-level, so it lives beside logout
 * rather than among the module links. */
export function ProfileLink({ onNavigate }: { onNavigate?: () => void }) {
  const active = usePathname() === "/profile";
  return (
    <Link
      href="/profile"
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 py-1.5 text-sm transition-colors",
        active ? "text-sidebar-foreground font-medium" : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
      )}
    >
      <UserCircle className="h-4 w-4 shrink-0" aria-hidden />
      Mijn profiel
    </Link>
  );
}
