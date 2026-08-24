import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { DayOption } from "@/lib/assignment-day-options";

interface Props {
  option: DayOption;
  onChange: (next: Partial<DayOption>) => void;
}

/** One day of the period in the day picker (H6): tick it to book it, then
 * refine the hours. Extracted from assignment-days-popover.tsx to keep
 * both files inside the 150-line limit. */
export function AssignmentDayRow({ option, onChange }: Props) {
  return (
    <label className="flex items-center gap-2 rounded px-1 py-1 hover:bg-accent">
      <Checkbox
        checked={option.selected}
        onCheckedChange={(checked) => onChange({ selected: checked === true })}
        aria-label={option.label}
      />
      <span className="min-w-0 flex-1 truncate text-xs">{option.label}</span>
      <Input
        type="time"
        value={option.from}
        disabled={!option.selected}
        onChange={(e) => onChange({ from: e.target.value })}
        className="h-7 w-[5.5rem] shrink-0 px-1.5 text-xs"
        aria-label={`Van ${option.label}`}
      />
      <Input
        type="time"
        value={option.to}
        disabled={!option.selected}
        onChange={(e) => onChange({ to: e.target.value })}
        className="h-7 w-[5.5rem] shrink-0 px-1.5 text-xs"
        aria-label={`Tot ${option.label}`}
      />
    </label>
  );
}
