"use client";

import React from "react";
import { Button } from "@/components/ui/button";

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 1.5cm; }
  html, body { background: white !important; }
  body * { visibility: hidden; }
  .print-root, .print-root * { visibility: visible; }
  .print-root { position: absolute; inset: 0; }
  .no-print { display: none !important; }
  /* Force a fixed light look for printing, regardless of the on-screen theme. */
  .print-paper {
    background: #fff !important;
    color: #000 !important;
    font-size: 10pt;
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0 0);
    --muted: oklch(0.95 0 0);
    --muted-foreground: oklch(0.44 0 0);
    --border: oklch(0.8 0 0);
    --secondary: oklch(0.91 0 0);
    --secondary-foreground: oklch(0.205 0 0);
  }
  table { border-collapse: collapse; width: 100%; }
  table td, table th { border: 1px solid #ccc; padding: 4px 6px; }
  table thead { background: #f0f0f0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1, h2, h3 { color: #000 !important; }
}
`;

interface PrintLayoutProps {
  children: React.ReactNode;
}

export function PrintLayout({ children }: PrintLayoutProps) {
  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="print-root">
        <div className="no-print flex gap-3 mb-6 p-4 border-b border-border">
          <Button onClick={() => window.print()}>Afdrukken</Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            ← Terug
          </Button>
        </div>
        {/* On screen the document follows the app theme (semantic tokens);
            printing forces a fixed light look via the .print-paper rules in
            PRINT_CSS. */}
        <div className="print-paper mx-auto max-w-4xl">{children}</div>
      </div>
    </>
  );
}
