"use client";

import { useRef, useEffect } from "react";
import QRCode from "qrcode";
import type { Material } from "@/types";

interface MaterialLabelProps {
  material: Material;
  origin?: string;
}

export function MaterialLabel({ material, origin = "" }: MaterialLabelProps) {
  const qrRef = useRef<HTMLCanvasElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const deepLink = `${origin}/materials?materialId=${material.id}`;

  useEffect(() => {
    if (qrRef.current) {
      QRCode.toCanvas(qrRef.current, deepLink, { width: 60, margin: 1, color: { dark: "#000", light: "#fff" } });
    }
  }, [deepLink]);

  useEffect(() => {
    if (!barcodeRef.current || !material.code) return;
    import("jsbarcode").then(({ default: JsBarcode }) => {
      JsBarcode(barcodeRef.current!, material.code!, {
        format: "CODE128", width: 1, height: 24, displayValue: true, fontSize: 7, margin: 2,
      });
    });
  }, [material.code]);

  const catName = material.categoryRel?.name ?? material.category ?? "";

  return (
    <div className="label-cell" style={{ border: "1px solid #ccc", padding: "4px", display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden", height: "100%" }}>
      <div>
        <p style={{ fontSize: "9px", color: "#888", margin: 0 }}>{catName}</p>
        <p style={{ fontSize: "10px", fontWeight: "bold", margin: "1px 0", lineHeight: 1.2 }}>{material.name}</p>
        <p style={{ fontSize: "8px", fontFamily: "monospace", color: "#444", margin: 0 }}>{material.code ?? "TEMP"}</p>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", marginTop: "2px" }}>
        {material.code && <svg ref={barcodeRef} style={{ flex: 1 }} />}
        <canvas ref={qrRef} style={{ width: 40, height: 40, flexShrink: 0 }} />
      </div>
    </div>
  );
}
