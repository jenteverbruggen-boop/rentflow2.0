"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useRoles } from "@/hooks/use-roles";
import { usePermissions } from "@/hooks/use-permissions";
import {
  exceedsBaseline,
  diffAgainstRecommended,
  buildRecommendedMatrix,
} from "@/lib/recommended-permissions";
import { RecommendedDefaultsDialog } from "@/components/recommended-defaults-dialog";

/**
 * Required, not optional (N3.3) — the matrix ships fully open (C1), so
 * this banner is what actually closes the hole the PO reported. Without
 * it the phase installs a mechanism nobody turns on.
 */
export function OpenPermissionsBanner() {
  const { query: rolesQuery } = useRoles();
  const roles = rolesQuery.data ?? [];
  const { query: permsQuery, save } = usePermissions();
  const permissions = permsQuery.data ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);

  if (!rolesQuery.data || !permsQuery.data) return null;
  if (!exceedsBaseline(permissions, roles)) return null;

  const diffRows = diffAgainstRecommended(permissions, roles);

  return (
    <>
      <Alert>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>Alle rollen hebben momenteel volledige toegang.</span>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            Pas aanbevolen standaarden toe
          </Button>
        </AlertDescription>
      </Alert>

      <RecommendedDefaultsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rows={diffRows}
        isPending={save.isPending}
        onApply={() =>
          save.mutate(buildRecommendedMatrix(permissions, roles), {
            onSuccess: () => setDialogOpen(false),
          })
        }
      />
    </>
  );
}
