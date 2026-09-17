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

// requireModule (api-auth.ts) unconditionally refuses any non-"lezen"
// action for a scope: "own" role — so "wijzigen"/"verwijderen" here are
// dead letters for those roles regardless of module (B2b). Disabled
// rather than hidden, so an already-saved value stays visible.
const OWN_SCOPE_DEAD_LETTER_HELP =
  "Deze rol is beperkt tot eigen gegevens (scope: own). Wijzigen en verwijderen worden altijd geweigerd, ongeacht deze instelling.";

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
      <td className="sticky left-0 z-10 border-r bg-card py-2 pr-4 text-sm font-medium whitespace-nowrap">
        {moduleLabel}
      </td>
      {roles.map((r) => {
        const isOwnScope = r.scope === "own";
        return (
          <td key={r.id} className="py-2 pr-3">
            <Select
              value={getAccess(r.id, moduleKey)}
              onValueChange={(v) => onChange(r.id, moduleKey, v as AccessLevel)}
            >
              <SelectTrigger
                className="h-8 w-32 text-xs"
                title={isOwnScope ? OWN_SCOPE_DEAD_LETTER_HELP : undefined}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => {
                  const disabled = isOwnScope && l.value !== "geen" && l.value !== "lezen";
                  return (
                    <SelectItem
                      key={l.value}
                      value={l.value}
                      disabled={disabled}
                      title={disabled ? OWN_SCOPE_DEAD_LETTER_HELP : undefined}
                    >
                      {l.label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </td>
        );
      })}
    </tr>
  );
}
