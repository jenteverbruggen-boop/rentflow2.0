import { describe, it, expect } from "vitest";
import { resolvePackingListPatch } from "@/lib/packing-list";

const NOW = new Date("2026-08-16T10:00:00Z");

describe("resolvePackingListPatch", () => {
  it("ticking 'shipped' stamps shippedAt with the server's own now", () => {
    const result = resolvePackingListPatch({ shipped: true, currentlyShipped: false }, NOW);
    expect(result.data.shippedAt).toBe(NOW);
    expect(result.error).toBeUndefined();
  });

  it("un-ticking 'shipped' also clears 'returned' — can't be back if never confirmed out", () => {
    const result = resolvePackingListPatch({ shipped: false, currentlyShipped: true }, NOW);
    expect(result.data.shippedAt).toBeNull();
    expect(result.data.returnedAt).toBeNull();
  });

  it("ticking 'returned' when already shipped succeeds", () => {
    const result = resolvePackingListPatch({ returned: true, currentlyShipped: true }, NOW);
    expect(result.data.returnedAt).toBe(NOW);
    expect(result.error).toBeUndefined();
  });

  it("ticking 'returned' when not yet shipped is refused, no partial write", () => {
    const result = resolvePackingListPatch({ returned: true, currentlyShipped: false }, NOW);
    expect(result.error).toBeDefined();
    expect(result.data.returnedAt).toBeUndefined();
  });

  it("shipping and returning in the same request succeeds (both toggles true together)", () => {
    const result = resolvePackingListPatch({ shipped: true, returned: true, currentlyShipped: false }, NOW);
    expect(result.error).toBeUndefined();
    expect(result.data.shippedAt).toBe(NOW);
    expect(result.data.returnedAt).toBe(NOW);
  });

  it("un-shipping and returning in the same request is refused — shipped:false wins first", () => {
    const result = resolvePackingListPatch({ shipped: false, returned: true, currentlyShipped: true }, NOW);
    expect(result.error).toBeDefined();
  });

  it("un-ticking 'returned' only clears returnedAt, shippedAt stays untouched", () => {
    const result = resolvePackingListPatch({ returned: false, currentlyShipped: true }, NOW);
    expect(result.data.returnedAt).toBeNull();
    expect(result.data.shippedAt).toBeUndefined();
  });

  it("neither toggle present produces an empty patch", () => {
    const result = resolvePackingListPatch({ currentlyShipped: true }, NOW);
    expect(result.data).toEqual({});
  });
});
