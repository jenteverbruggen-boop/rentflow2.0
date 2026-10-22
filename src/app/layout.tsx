import type { Metadata, Viewport } from "next";
import { QueryProvider } from "@/providers/query-provider";
import { RegisterServiceWorker } from "@/components/register-sw";
import { InlineScript } from "@/components/inline-script";
import "./globals.css";

export const metadata: Metadata = {
  title: "RentFlow",
  description: "Rental project management",
};

export const viewport: Viewport = { themeColor: "#2a266e" };

// Applied before paint to avoid a theme flash. Defaults to dark unless the
// user explicitly stored "light".
const themeScript = `try{if(localStorage.getItem('theme')==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){document.documentElement.classList.add('dark')}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <head>
        <InlineScript html={themeScript} />
      </head>
      <body suppressHydrationWarning>
        <QueryProvider>{children}</QueryProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
