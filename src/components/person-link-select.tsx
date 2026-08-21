"use client";

import { EntityCombobox } from "@/components/entity-combobox";
import { usePeople } from "@/hooks/use-people";
import { useUsers } from "@/hooks/use-users";

interface Props {
  value: number | null | undefined;
  onChange: (personId: number | null) => void;
  disabled?: boolean;
}

/** F3 follow-up — links a User to a Person so `scope: own` (freelancer)
 * roles have something to filter on (own-data-scoping-design.md §1).
 * The API side (`resolvePersonLink`, PATCH/POST /api/users) already
 * existed; this is the picker no form ever wired up.
 *
 * `useUsers()` shares the ["users"] query the users page itself already
 * fetches — no extra request in practice, just a cache read — used here
 * only to hide people already linked to a *different* user, so the
 * picker can't steer two admins toward the same P2002 conflict. The
 * person currently linked to *this* user (`value`) is never excluded,
 * so re-opening the same link stays visible. */
export function PersonLinkSelect({ value, onChange, disabled }: Props) {
  const { data: people, isLoading: peopleLoading } = usePeople();
  const { query: usersQuery } = useUsers();

  const taken = new Set(
    (usersQuery.data ?? [])
      .map((u) => u.personId)
      .filter((id): id is number => id != null && id !== value),
  );
  const items = (people ?? [])
    .filter((p) => !taken.has(p.id))
    .map((p) => ({ id: p.id, name: p.name }));

  const isLoading = peopleLoading || usersQuery.isLoading;
  return (
    <EntityCombobox
      items={items}
      value={value}
      onChange={onChange}
      placeholder={isLoading ? "Laden..." : "Niet gekoppeld"}
      disabled={disabled || isLoading}
    />
  );
}
