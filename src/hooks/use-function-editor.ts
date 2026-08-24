import { useState } from "react";
import { useFunctions } from "@/hooks/use-functions";
import type { Function as Fn } from "@/types";

/**
 * State + save wiring for the pencil-edit dialog a person-form function
 * chip (function-chip-row.tsx) opens on the company-default Function
 * catalogue entry. Extracted out of person-form.tsx to keep that file
 * under the 150-line limit.
 *
 * `useFunctions().update`'s own `onSuccess` already invalidates the
 * `["functions"]` query key, so a successful edit here refreshes every
 * chip's placeholder default immediately without any extra plumbing.
 */
export function useFunctionEditor() {
  const { update } = useFunctions();
  const [editing, setEditing] = useState<Fn | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  function openEditor(fn: Fn) {
    setEditing(fn);
    setError("");
    setOpen(true);
  }

  function submit(values: { name: string; dayRate: number | null; hourRate: number | null }) {
    if (!editing) return;
    update.mutate(
      { id: editing.id, ...values },
      {
        onSuccess: () => setOpen(false),
        onError: (err) => setError((err as Error).message),
      },
    );
  }

  return { open, setOpen, editing, error, isPending: update.isPending, openEditor, submit };
}
