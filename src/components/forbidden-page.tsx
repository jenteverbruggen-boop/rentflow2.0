import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Dutch 403 page (N4.3) — shown when a per-page server-side check
 * rejects the current user, instead of the page shell with no data. */
export function ForbiddenPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <h2 className="text-2xl font-bold">Geen toegang</h2>
      <p className="text-muted-foreground max-w-sm">
        Je hebt geen rechten om deze pagina te bekijken. Neem contact op met een beheerder als je denkt dat dit niet klopt.
      </p>
      <Button asChild variant="outline" className="mt-2">
        <Link href="/">Terug naar dashboard</Link>
      </Button>
    </div>
  );
}
