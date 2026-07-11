"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import type { Material } from "@/types";

interface MaterialCodesProps {
  material: Material;
}

export function MaterialCodes({ material }: MaterialCodesProps) {
  const qrRef = useRef<HTMLCanvasElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);

  const code = material.code;
  const deepLink = typeof window !== "undefined"
    ? `${window.location.origin}/materials?materialId=${material.id}`
    : `/materials?materialId=${material.id}`;

  useEffect(() => {
    if (!qrRef.current) return;
    QRCode.toCanvas(qrRef.current, deepLink, { width: 120, margin: 1, color: { dark: "#000", light: "#fff" } });
  }, [deepLink]);

  useEffect(() => {
    if (!barcodeRef.current || !code) return;
    import("jsbarcode").then(({ default: JsBarcode }) => {
      JsBarcode(barcodeRef.current!, code, {
        format: "CODE128",
        width: 1.5,
        height: 40,
        displayValue: true,
        fontSize: 11,
        margin: 4,
      });
    });
  }, [code]);

  if (!code) {
    return (
      <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
        Geen code — genereer eerst een artikelcode
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-4 items-start">
      <div>
        <p className="text-xs text-muted-foreground mb-1">Code 128</p>
        <svg ref={barcodeRef} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">QR (deeplink)</p>
        <canvas ref={qrRef} />
      </div>
    </div>
  );
}
