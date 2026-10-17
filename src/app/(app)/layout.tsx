import { Sidebar } from "@/components/sidebar";
import { MobileTopBar } from "@/components/mobile-sidebar";
import { LinkedPersonWarning } from "@/components/linked-person-warning";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AccountThemeSync } from "@/components/account-theme-sync";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      {/* Applies the account's saved light/dark theme on every page. */}
      <AccountThemeSync />
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <MobileTopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <LinkedPersonWarning />
          {/* Every tooltip in the app (stock units, overbook badges…) needs a
              provider; only the project page had one, so e.g. the stock sheet
              on /materials crashed. */}
          <TooltipProvider>{children}</TooltipProvider>
        </main>
      </div>
    </div>
  );
}
