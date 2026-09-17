import { resolveCurrentAccess } from "@/lib/api-auth";
import { satisfies } from "@/lib/modules";
import { ForbiddenPage } from "@/components/forbidden-page";
import { CalendarFeedLinks } from "@/components/calendar-feed-links";

// Server Component (N4.3), mirroring settings/page.tsx and users/page.tsx.
// O1.4/B2d: agenda-feed management is self-service for any planning-capable
// role, not settings-admin-only — this page gates on `planning: lezen`
// directly instead of inheriting Settings' `instellingen: lezen` gate, so a
// role with planning access but no settings access (e.g. a bespoke
// freelancer/coordinator role) can still reach its own "Mijn diensten" feed.
// `CalendarFeedLinks` itself still enforces the stricter, separate gate for
// the company-wide row (`scope !== "own"`) — unchanged here.
export default async function AgendaFeedsPage() {
  const access = await resolveCurrentAccess().catch(() => null);
  const held = access?.permissions.planning ?? "geen";

  if (!satisfies(held, "lezen")) {
    return <ForbiddenPage />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold">Agenda-feeds</h2>
      <CalendarFeedLinks />
    </div>
  );
}
