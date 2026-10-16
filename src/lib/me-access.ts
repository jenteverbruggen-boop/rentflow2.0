import { satisfies } from "@/lib/modules";
import type { AuthMe } from "@/hooks/use-auth-me";
import type { AccessLevel, ModuleKey } from "@/types";

/** Client-side mirror of the server checks, for hiding UI the API would
 * refuse anyway. The server stays the authority. */
export function hasAccess(me: AuthMe | undefined, module: ModuleKey, level: AccessLevel = "lezen"): boolean {
  return !!me && satisfies(me.permissions[module] ?? "geen", level);
}

/** Same rule as `moneyVisible` (src/lib/redact.ts): own scope never sees money. */
export function canSeeMoney(me: AuthMe | undefined): boolean {
  return !!me && me.scope !== "own" && hasAccess(me, "kosten_facturen");
}
