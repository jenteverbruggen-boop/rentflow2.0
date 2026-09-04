"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  usePersonLinkSuggestions,
  useApplyPersonLink,
} from "@/hooks/use-person-link-suggestions";
import { useAuthMe } from "@/hooks/use-auth-me";
import { satisfies } from "@/lib/modules";

/** Surfaces the unambiguous e-mail matches on both the People and the
 * Users page. Nothing is linked automatically — a link decides what a
 * `scope: own` role can see, so it stays an explicit admin action, and
 * users who should legitimately never be linked simply never appear
 * here (no e-mail match, no nagging). */
export function PersonLinkSuggestionsBanner() {
  const { data: me } = useAuthMe();
  const canLink = satisfies(me?.permissions.gebruikers ?? "geen", "wijzigen");
  const { data: suggestions = [] } = usePersonLinkSuggestions(
    satisfies(me?.permissions.gebruikers ?? "geen", "lezen"),
  );
  const apply = useApplyPersonLink();

  if (suggestions.length === 0) return null;

  return (
    <Alert>
      <AlertTitle>
        {suggestions.length === 1
          ? "1 gebruiker lijkt bij een persoon te horen"
          : `${suggestions.length} gebruikers lijken bij een persoon te horen`}
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-muted-foreground">
          Het e-mailadres komt exact overeen. Koppelen is niet verplicht,
          maar zonder koppeling heeft de gebruiker geen persoonlijke
          agenda-feed.
        </p>
        <ul className="space-y-1">
          {suggestions.map((s) => (
            <li key={s.userId} className="flex flex-wrap items-center gap-2">
              <span className="text-foreground">
                {s.userName} → {s.personName}
              </span>
              <span className="text-muted-foreground text-xs break-all">
                {s.userEmail}
              </span>
              {canLink && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={apply.isPending}
                  onClick={() =>
                    apply.mutate({ userId: s.userId, personId: s.personId })
                  }
                >
                  Koppelen
                </Button>
              )}
            </li>
          ))}
        </ul>
        {apply.isError && (
          <p className="text-destructive">{(apply.error as Error).message}</p>
        )}
      </AlertDescription>
    </Alert>
  );
}
