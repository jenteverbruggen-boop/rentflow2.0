"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface InlineEditFieldProps {
  label: string;
  value: string | number | null;
  displayValue?: string;
  type?: "text" | "number";
  onSave: (newValue: string) => Promise<void>;
}

export function InlineEditField({
  label,
  value,
  displayValue,
  type = "text",
  onSave,
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(value ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setInputValue(String(value ?? ""));
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, value]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave(inputValue);
      setEditing(false);
    } catch {
      setError("Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setEditing(false);
    setError(null);
  }

  if (editing) {
    return (
      <div className="rounded-md border border-border p-3">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            type={type}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            className="h-7 text-sm"
            disabled={saving}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-primary hover:opacity-70 text-sm px-1"
            title="Opslaan"
          >
            ✓
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="text-muted-foreground hover:opacity-70 text-sm px-1"
            title="Annuleren"
          >
            ✕
          </button>
        </div>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <button
      className="rounded-md border border-border p-3 text-left w-full hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => setEditing(true)}
      title="Klik om te bewerken"
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-sm">
        {displayValue ?? String(value ?? "—")}
      </p>
    </button>
  );
}
