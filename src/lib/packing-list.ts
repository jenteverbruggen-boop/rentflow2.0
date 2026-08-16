/**
 * Packing-list checklist (Future plan list item): resolves the two
 * boolean toggles (`shipped`/`returned`) a PATCH request can send into
 * the `shippedAt`/`returnedAt` write, given whether the row is
 * *currently* shipped (needed to validate "returned" without a fresh DB
 * round-trip when both toggles arrive in the same request). The server
 * always stamps `now` itself — never trusts a client-supplied
 * timestamp — via the `now` parameter, passed in rather than read
 * internally so this stays a pure, easily-tested function.
 */
export interface PackingListToggleInput {
  shipped?: boolean;
  returned?: boolean;
  currentlyShipped: boolean;
}

export interface PackingListPatch {
  data: { shippedAt?: Date | null; returnedAt?: Date | null };
  error?: string;
}

export function resolvePackingListPatch(input: PackingListToggleInput, now: Date): PackingListPatch {
  const data: PackingListPatch["data"] = {};
  let willBeShipped = input.currentlyShipped;

  if (input.shipped !== undefined) {
    if (input.shipped) {
      data.shippedAt = now;
      willBeShipped = true;
    } else {
      // Un-ticking "shipped" also clears "returned" — a unit can't be
      // back if it was never confirmed out.
      data.shippedAt = null;
      data.returnedAt = null;
      willBeShipped = false;
    }
  }

  if (input.returned !== undefined) {
    if (input.returned) {
      if (!willBeShipped) {
        return { data, error: "Kan niet als geretourneerd markeren voordat de unit als verzonden is gemarkeerd" };
      }
      data.returnedAt = now;
    } else {
      data.returnedAt = null;
    }
  }

  return { data };
}
