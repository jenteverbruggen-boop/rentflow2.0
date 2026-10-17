"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useAuthMe } from "@/hooks/use-auth-me";
import { visibleNavLinks } from "@/lib/nav-links";
import { NavLinkList } from "@/components/nav-link-list";
import { ProfileLink } from "@/components/profile-link";

export function MobileTopBar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data: me } = useAuthMe();
  // While permissions are still resolving, show only the always-visible
  // links (Dashboard) rather than flashing the full list then narrowing it.
  const links = visibleNavLinks(me?.permissions ?? {});

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-sidebar-border bg-sidebar shrink-0">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Menu openen</span>
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-64 bg-sidebar border-r border-sidebar-border p-0 flex flex-col"
        >
          <SheetHeader className="p-5 border-b border-sidebar-border">
            <SheetTitle className="text-xl font-bold text-primary text-left">RentFlow</SheetTitle>
          </SheetHeader>
          <NavLinkList links={links} onNavigate={() => setOpen(false)} />
          <Separator className="bg-sidebar-border" />
          <div className="p-4 space-y-1">
            <ProfileLink onNavigate={() => setOpen(false)} />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 px-0"
            >
              Uitloggen
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <span className="text-base font-bold text-primary">RentFlow</span>
    </header>
  );
}
