import type { ResolvedAccess } from "@/lib/api-auth";
import { computeBundleStock } from "@/lib/bundle-stock";
import { computeSharingMap } from "@/lib/bundle-sharing";
import { toNumber, toNumberOrNull } from "@/lib/serialize";
import { redactMoney } from "@/lib/redact";

interface MaterialRow {
  id: number;
  isBundle: boolean;
  dayPrice: unknown;
  setupCost: unknown;
  bundlePriceOverride: unknown;
  _count: { stockItems: number };
  components: {
    childId: number;
    quantity: number;
    child: {
      name: string;
      code: string | null;
      dayPrice: unknown;
      _count: { stockItems: number };
    };
  }[];
  usedInBundles?: { parent: { id: number; name: string }; quantity: number }[];
}

/**
 * GET /api/materials's per-row serialization + bundle-stock computation +
 * redaction, extracted out of the route handler (N2.1) to keep that file
 * under the 150-line limit.
 */
export function serializeMaterialsList<T extends MaterialRow>(
  materials: T[],
  access: ResolvedAccess,
) {
  const allComponents = materials.flatMap((m) =>
    m.components.map((c) => ({
      parentId: m.id,
      parentName: (m as unknown as { name: string }).name,
      childId: c.childId,
    })),
  );
  const sharingMap = computeSharingMap(allComponents);

  return materials.map((m) => {
    const usedInSets = (m.usedInBundles ?? []).map((u) => ({
      id: u.parent.id,
      name: u.parent.name,
      quantity: u.quantity,
    }));
    const base = {
      ...m,
      dayPrice: toNumber(m.dayPrice),
      setupCost: toNumberOrNull(m.setupCost),
      bundlePriceOverride: toNumberOrNull(m.bundlePriceOverride),
      totalStock: m._count.stockItems,
      usedInSets,
    };
    if (!m.isBundle) return redactMoney(base, access);

    const bundleStock = computeBundleStock(
      m.components.map((c) => ({
        childId: c.childId,
        name: c.child.name,
        code: c.child.code,
        needPerSet: c.quantity,
        totalStock: c.child._count.stockItems,
        dayPrice: toNumber(c.child.dayPrice),
        sharedWith: sharingMap.get(c.childId)?.filter((s) => s.id !== m.id) ?? [],
      })),
    );
    const setPrice =
      m.bundlePriceOverride != null
        ? toNumber(m.bundlePriceOverride)
        : bundleStock.componentSum;
    return redactMoney({ ...base, bundleStock, setPrice }, access);
  });
}
