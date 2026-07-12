"use client";

import * as React from "react";
import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Native date/datetime inputs are finicky: the calendar only opens from the
// tiny native icon, and Chrome's shadow-DOM layout (made worse by the app's
// flex Input) clusters that icon left with dead space to its right. Its
// position is UA-controlled and can't be reliably fixed via margin/flex/justify
// on the ::-webkit shadow pseudos. So we hide the native icon, render our own
// pinned to the right with normal CSS, and open the picker on any click via
// showPicker() — layout-engine independent, so it behaves the same everywhere.
export function DateInput({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <Input
        {...props}
        className={cn(
          // Hide the native icon visually (opacity, not display:none — Chrome
          // ignores display on this pseudo) so only our right-pinned icon shows.
          "pr-9 [&::-webkit-calendar-picker-indicator]:opacity-0",
          className,
        )}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.();
          } catch {
            // ignore — input still editable/focusable
          }
          onClick?.(e);
        }}
      />
      <Calendar
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 opacity-60"
      />
    </div>
  );
}
