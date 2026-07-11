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
  body { color: #000 !important; font-size: 10pt; }
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
          <Button variant="outline" onClick={() => window.history.back()}>← Terug</Button>
        </div>
        {children}
      </div>
    </>
  );
}
