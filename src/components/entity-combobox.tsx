"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface EntityComboboxProps {
  items: { id: number; name: string }[];
  value?: number | null;
  onChange: (id: number | null) => void;
  onCreate?: (name: string) => Promise<{ id: number }>;
  placeholder?: string;
  createLabel?: string;
  disabled?: boolean;
}

export function EntityCombobox({ items, value, onChange, onCreate, placeholder = "Selecteer...", createLabel = "+ Nieuw aanmaken", disabled }: EntityComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const selected = items.find((i) => i.id === value);
  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  async function handleCreate() {
    if (!onCreate || !search.trim()) return;
    setCreating(true);
    try {
      const created = await onCreate(search.trim());
      onChange(created.id);
      setOpen(false);
      setSearch("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal" disabled={disabled} type="button">
          <span className="truncate">{selected?.name ?? placeholder}</span>
          <span className="opacity-50 ml-2">▾</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Zoeken..." value={search} onValueChange={setSearch} />
          <CommandEmpty>
            {onCreate && search.trim() ? (
              <button
                className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-accent"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? "Aanmaken..." : `${createLabel}: "${search}"`}
              </button>
            ) : (
              <p className="py-2 px-3 text-sm text-muted-foreground">Geen resultaten</p>
            )}
          </CommandEmpty>
          <CommandGroup>
            {value != null && (
              <CommandItem onSelect={() => { onChange(null); setOpen(false); }} className="text-muted-foreground">
                — Geen selectie
              </CommandItem>
            )}
            {filtered.map((item) => (
              <CommandItem
                key={item.id}
                value={item.name}
                onSelect={() => { onChange(item.id); setOpen(false); setSearch(""); }}
              >
                {item.name}
              </CommandItem>
            ))}
            {onCreate && search.trim() && filtered.length > 0 && (
              <CommandItem onSelect={handleCreate} disabled={creating} className="text-primary">
                {creating ? "Aanmaken..." : `${createLabel}: "${search}"`}
              </CommandItem>
            )}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
