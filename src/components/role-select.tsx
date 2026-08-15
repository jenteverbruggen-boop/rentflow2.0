import { useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRoles } from "@/hooks/use-roles";

interface Props {
  value: number | undefined;
  onChange: (roleId: number) => void;
}

/** Role dropdown, extracted from user-form.tsx (N1.5) — now fetches
 * GET /api/roles instead of three hardcoded SelectItems, and submits
 * roleId instead of a role string. Defaults to PLANNER once the list
 * loads if nothing is selected yet (new-user case). */
export function RoleSelect({ value, onChange }: Props) {
  const { data: roles = [] } = useRoles();

  useEffect(() => {
    if (value == null && roles.length > 0) {
      const planner = roles.find((r) => r.key === "PLANNER");
      if (planner) onChange(planner.id);
    }
  }, [value, roles, onChange]);

  return (
    <Select
      onValueChange={(v) => onChange(Number(v))}
      value={value != null ? String(value) : undefined}
    >
      <SelectTrigger>
        <SelectValue placeholder="Kies een rol..." />
      </SelectTrigger>
      <SelectContent>
        {roles.map((r) => (
          <SelectItem key={r.id} value={String(r.id)}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
