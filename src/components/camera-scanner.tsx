"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CameraScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CameraScanner({ open, onOpenChange }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const router = useRouter();
  const streamRef = useRef<MediaStream | null>(null);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setScanning(true);
    } catch {
      setError("Geen toegang tot de camera");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  useEffect(() => {
    if (open) startCamera();
    else stopCamera();
    return stopCamera;
  }, [open]);

  async function handleResult(text: string) {
    stopCamera();
    onOpenChange(false);

    // If it looks like a URL (QR deep-link), navigate directly
    if (text.startsWith("http")) {
      try {
        const url = new URL(text);
        router.push(url.pathname + url.search);
      } catch { /* noop */ }
      return;
    }

    // Otherwise try Code128 lookup
    const res = await fetch(`/api/materials?code=${encodeURIComponent(text)}`);
    const data = await res.json();
    if (data?.[0]?.id) {
      router.push(`/materials?materialId=${data[0].id}`);
    } else {
      setError("Geen materiaal gevonden voor deze code");
    }
  }

  useEffect(() => {
    if (!scanning) return;

    const scan = async () => {
      if (!videoRef.current) return;

      // Try native BarcodeDetector
      if ("BarcodeDetector" in window) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code", "code_128"] });
        const tick = async () => {
          if (!videoRef.current || !streamRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0) { handleResult(results[0].rawValue); return; }
          } catch { /* noop */ }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } else {
        // Fallback: @zxing/browser
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        if (!videoRef.current) return;
        try {
          await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
            if (result) { handleResult(result.getText()); }
          });
        } catch { /* user cancelled or not found */ }
      }
    };

    scan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Scan materiaalcode</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <video ref={videoRef} autoPlay playsInline className="w-full rounded-md bg-black aspect-square object-cover" />
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>Annuleren</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
