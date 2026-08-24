import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type QuantityInputProps = Omit<ComponentProps<typeof Input>, "type">;

/** Number input for quantity fields — hides the native spinners (which ate
 * width without earning it) and grows with the digit count, so 4-6 digit
 * quantities stay fully readable instead of clipping. material-available-
 * row.tsx (w-12), bundle-component-row.tsx (w-14) and person-travel-
 * editor.tsx (w-12) all had that problem.
 *
 * The 5.5ch floor lands at ~49px — no narrower than the old w-12 for the
 * common 1-2 digit case, since the Input's own px-3 already eats 24px of
 * whatever width is set here. */
export function QuantityInput({ className, value, ...props }: QuantityInputProps) {
  const digits = String(value ?? "").length;
  return (
    <Input
      type="number"
      value={value}
      style={{ width: `${Math.max(5.5, digits + 4.5)}ch` }}
      className={cn(
        "text-right tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        className,
      )}
      {...props}
    />
  );
}
