import { Sidebar } from "@/components/sidebar";
import { MobileTopBar } from "@/components/mobile-sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <MobileTopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
