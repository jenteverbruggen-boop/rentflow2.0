import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}

/** K2.2 — date-range control shared by every range-scoped section on
 * /cijfers. Payback (K2.4) deliberately ignores this — it's rendered
 * in its own, visually separate section so nobody reads it as "this
 * month". */
export function StatsDateRange({ from, to, onFromChange, onToChange }: Props) {
  return (
    <div className="flex items-end gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Van</Label>
        <Input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} className="w-40" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Tot</Label>
        <Input type="date" value={to} onChange={(e) => onToChange(e.target.value)} className="w-40" />
      </div>
    </div>
  );
}
