"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuthMe } from "@/hooks/use-auth-me";

/** own-data-scoping-design.md §6 — a `scope: own` account with no
 * linked Person sees an empty app everywhere (every list query resolves
 * through an impossible `personId: -1` filter, scope-filter.ts) and
 * was never told why. `/api/auth/me` already computed
 * `linkedPersonMissing`; nothing rendered it. One banner in the app
 * shell covers every scoped page, per the design doc's own intent. */
export function LinkedPersonWarning() {
  const { data } = useAuthMe();
  if (!data?.linkedPersonMissing) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertDescription>
        Je account is nog niet gekoppeld aan een persoon — je ziet daardoor
        nergens gegevens. Neem contact op met de beheerder.
      </AlertDescription>
    </Alert>
  );
}
