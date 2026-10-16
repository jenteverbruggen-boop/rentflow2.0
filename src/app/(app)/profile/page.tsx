import { requireAuth, resolveCurrentAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { satisfies } from "@/lib/modules";
import { CalendarFeedLinks } from "@/components/calendar-feed-links";

// Server Component. Open to every authenticated user — the account block
// has no module gate. The agenda-feed section keeps the O1.4/B2d gate
// (`planning: lezen`, deliberately not `instellingen`) so a planning-capable
// role with no settings access can still reach its own "Mijn diensten" feed.
// `CalendarFeedLinks` itself still enforces the stricter gate for the
// company-wide row (`scope !== "own"`).
export default async function ProfilePage() {
  const payload = await requireAuth();
  const [access, user] = await Promise.all([
    resolveCurrentAccess().catch(() => null),
    prisma.user.findUnique({
      where: { id: payload.id },
      select: { name: true, email: true, roleRel: { select: { label: true } } },
    }),
  ]);
  const showFeeds = satisfies(access?.permissions.planning ?? "geen", "lezen");

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold">Mijn profiel</h2>
      <dl className="grid grid-cols-[8rem_1fr] gap-y-2 rounded-lg border border-border p-4 text-sm">
        <dt className="text-muted-foreground">Naam</dt>
        <dd>{user?.name}</dd>
        <dt className="text-muted-foreground">E-mail</dt>
        <dd>{user?.email}</dd>
        <dt className="text-muted-foreground">Rol</dt>
        <dd>{user?.roleRel.label}</dd>
      </dl>
      {showFeeds && <CalendarFeedLinks />}
    </div>
  );
}
