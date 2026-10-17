import Link from "next/link";
import { Button } from "@/components/ui/button";
import { anonymousHolders, freeForLine } from "@/lib/holders-label";
import type { ProjectShortageLine } from "@/lib/project-shortages";
import type { StockHint } from "@/types";

interface Props {
  line: ProjectShortageLine;
  hint?: StockHint;
  onHire: () => void;
}

/** One open overbooked line in the banner: what is missing, how many units
 * are free right now, and — when none are — which projects hold them. */
export function OverbookLine({ line: l, hint, onHire }: Props) {
  const free = freeForLine(hint, l.quantity);
  const open = hint?.kind === "open" ? hint : null;
  return (
    <div className="space-y-0.5">
      <p className="flex flex-wrap items-center gap-2 text-xs">
        <span>
          {l.periodName} · {l.materialName} · {l.quantity} overboekt
          {l.isBundleComponent && " (onderdeel van een set)"}
        </span>
        <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={onHire}>
          Inhuren
        </Button>
      </p>
      {open && (
        <p className="text-xs text-muted-foreground">
          {free > 0 ? (
            <span className="text-emerald-700 dark:text-emerald-500">{free} nu vrij — toewijzen kan</span>
          ) : (
            <>Geen eigen unit vrij · </>
          )}
          {open.holders.length > 0 && free < l.quantity && (
            <>
              {free > 0 && " · "}
              {anonymousHolders(open.holders) ? (
                "bezet in een ander project"
              ) : (
                <>
                  bezet door{" "}
                  {open.holders.map((h, i) => (
                    <span key={h.projectId}>
                      {i > 0 && ", "}
                      <Link href={`/projects/${h.projectId}`} className="underline underline-offset-2">{h.name}</Link>
                      {` (${h.status})`}
                    </span>
                  ))}
                  {open.more > 0 && ` +${open.more}`}
                </>
              )}
            </>
          )}
        </p>
      )}
    </div>
  );
}
