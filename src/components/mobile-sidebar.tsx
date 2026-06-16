"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/projects", label: "Projecten", icon: "📁" },
  { href: "/planning", label: "Planning", icon: "📅" },
  { href: "/people", label: "Personen", icon: "👥" },
  { href: "/materials", label: "Materialen", icon: "📦" },
  { href: "/users", label: "Gebruikers", icon: "👤" },
] as const;

export function MobileTopBar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-sidebar-border bg-sidebar shrink-0">
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
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {NAV_LINKS.map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              >
                <span>{icon}</span>
                {label}
              </Link>
            ))}
          </nav>
          <Separator className="bg-sidebar-border" />
          <div className="p-4">
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
