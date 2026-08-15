import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AccessLevel, ModuleKey } from "@/types";
import type { RoleOption } from "@/hooks/use-roles";

const LEVELS: { value: AccessLevel; label: string }[] = [
  { value: "geen", label: "Geen" },
  { value: "lezen", label: "Lezen" },
  { value: "wijzigen", label: "Wijzigen" },
  { value: "verwijderen", label: "Verwijderen" },
];

interface Props {
  moduleKey: ModuleKey;
  moduleLabel: string;
  roles: RoleOption[];
  getAccess: (roleId: number, module: ModuleKey) => AccessLevel;
  onChange: (roleId: number, module: ModuleKey, access: AccessLevel) => void;
}

/** One module's row across every role column, extracted from
 * permission-matrix.tsx to keep that file under 150 lines (N3.2). */
export function PermissionMatrixRow({
  moduleKey,
  moduleLabel,
  roles,
  getAccess,
  onChange,
}: Props) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4 text-sm font-medium whitespace-nowrap">{moduleLabel}</td>
      {roles.map((r) => (
        <td key={r.id} className="py-2 pr-3">
          <Select
            value={getAccess(r.id, moduleKey)}
            onValueChange={(v) => onChange(r.id, moduleKey, v as AccessLevel)}
          >
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
      ))}
    </tr>
  );
}
