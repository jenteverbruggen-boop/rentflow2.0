"use client";

import Link from "next/link";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface PageAction {
  label: string;
  icon: LucideIcon;
  /** Navigation (internal route) or file download (/api/...). */
  href?: string;
  onSelect?: () => void;
}

/** The "⋯" next to a page's primary button: export, import and other
 * secondary actions, so each page shows one clear call to action. */
export function PageActionsMenu({ actions }: { actions: PageAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Meer acties">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map(({ label, icon: Icon, href, onSelect }) => (
          <DropdownMenuItem key={label} asChild={!!href} onSelect={onSelect}>
            {href ? (
              href.startsWith("/api/") ? (
                <a href={href} target="_blank" rel="noreferrer">
                  <Icon className="h-4 w-4" /> {label}
                </a>
              ) : (
                <Link href={href}>
                  <Icon className="h-4 w-4" /> {label}
                </Link>
              )
            ) : (
              <>
                <Icon className="h-4 w-4" /> {label}
              </>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
