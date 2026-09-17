"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface PrintLayoutProps {
  children: React.ReactNode;
  /** B1 — gates the print button so it can't fire before the document's
   * data (and the shared settings query) has actually resolved.
   * Optional/defaulted so existing callers keep working unchanged. */
  ready?: boolean;
}

export function PrintLayout({ children, ready = true }: PrintLayoutProps) {
  return (
    <div className="print-root">
      <div className="no-print flex gap-3 mb-6 p-4 border-b border-border">
        <Button onClick={() => window.print()} disabled={!ready}>
          Afdrukken
        </Button>
        <Button variant="outline" onClick={() => window.history.back()}>
          ← Terug
        </Button>
      </div>
      {/* On screen the document follows the app theme (semantic tokens);
          printing forces a fixed light look via the .print-paper rules in
          the shared @media print block (J3, src/app/globals.css). */}
      <div className="print-paper mx-auto max-w-4xl">{children}</div>
    </div>
  );
}
