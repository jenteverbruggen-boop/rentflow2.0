import { describe, it, expect } from "vitest";
import { findRejectedMoneyWrite, findRejectedField, moneyFieldsToIgnore } from "./money-write-guard";
import type { ResolvedAccess } from "@/lib/api-auth";

function access(kostenLevel: string, scope: ResolvedAccess["scope"] = "all"): ResolvedAccess {
  return {
    id: 1,
    personId: null,
    scope,
    permissions: { kosten_facturen: kostenLevel as never },
  };
}

// "lezen" is the money-VISIBLE-but-not-writable level throughout this
// file: the caller saw the true persisted value (so an unchanged echo
// is genuinely "no write" and a changed value is a genuine attempted
// write), as opposed to "geen" (or scope: "own"), which is money-BLIND —
// see the "money-blind caller" describe block below.
describe("findRejectedMoneyWrite (money-visible but not writable)", () => {
  // No `current` passed — the create path (POST /api/people,
  // /api/materials): compares against the field's own schema default
  // (dayPrice: 0), so a genuine non-zero value on create is still
  // rejected exactly as before this fix.
  it("rejects a dayPrice write without Kosten/Facturen: wijzigen", () => {
    expect(findRejectedMoneyWrite({ dayPrice: 100 }, access("lezen"))).toBe(
      "dayPrice",
    );
  });

  it("allows a dayPrice write with Kosten/Facturen: wijzigen", () => {
    expect(findRejectedMoneyWrite({ dayPrice: 100 }, access("wijzigen"))).toBeNull();
  });

  it("allows a write with no money fields present, regardless of access", () => {
    expect(findRejectedMoneyWrite({ name: "New name" }, access("geen"))).toBeNull();
  });

  // The original bug (see money-write-guard.ts's doc comment on
  // findRejectedMoneyWrite): PersonForm/MaterialForm always resubmit
  // dayPrice on every save, whether or not the user touched it. An
  // unchanged echo against the persisted row must not be treated as an
  // attempted money write.
  it("allows an unchanged dayPrice echo against the persisted value (the bug this fixes)", () => {
    expect(
      findRejectedMoneyWrite({ dayPrice: 300, name: "Alice" }, access("lezen"), { dayPrice: 300 }),
    ).toBeNull();
  });

  it("still rejects a genuine dayPrice change against the persisted value", () => {
    expect(
      findRejectedMoneyWrite({ dayPrice: 350 }, access("lezen"), { dayPrice: 300 }),
    ).toBe("dayPrice");
  });

  it("treats a Decimal-shaped persisted value as equal to the same submitted number", () => {
    const decimalish = {
      s: 1, e: 2, d: [300],
      toString: () => "300",
      toFixed: () => "300.00",
    };
    expect(
      findRejectedMoneyWrite({ dayPrice: 300 }, access("lezen"), { dayPrice: decimalish }),
    ).toBeNull();
  });

  it("allows the untouched dayPrice default (0) on create without Kosten access", () => {
    expect(findRejectedMoneyWrite({ dayPrice: 0, name: "New" }, access("lezen"))).toBeNull();
  });

  it("rejects a non-zero dayPrice on create (no persisted row yet) without Kosten access", () => {
    expect(findRejectedMoneyWrite({ dayPrice: 50 }, access("lezen"))).toBe("dayPrice");
  });

  it("allows an unchanged null setupCost echo against a persisted null", () => {
    expect(
      findRejectedMoneyWrite({ setupCost: null }, access("lezen"), { setupCost: null }),
    ).toBeNull();
  });

  it("rejects setting setupCost from null to a real value without Kosten access", () => {
    expect(
      findRejectedMoneyWrite({ setupCost: 15 }, access("lezen"), { setupCost: null }),
    ).toBe("setupCost");
  });

  // Fail-closed on malformed input rather than throwing (normalizeMoney's
  // NaN !== NaN trick) — a body that couldn't have come from the real
  // form is treated as a change, not silently allowed through. Only
  // meaningful for a money-visible caller: a money-blind one never
  // reaches this comparison at all (see below).
  it("rejects an unparseable dayPrice value even against a matching-looking persisted row", () => {
    expect(
      findRejectedMoneyWrite({ dayPrice: "not-a-number" }, access("lezen"), { dayPrice: 300 }),
    ).toBe("dayPrice");
  });
});

// The bug this whole task exists to fix: a caller who cannot see money
// at all (no Kosten/Facturen: lezen, or scope: "own") can never possibly
// echo the true persisted value back correctly — every money-bearing
// *diff-aware* form (PersonForm, MaterialForm, FunctionFormDialog)
// redacts it to 0/null first. Diffing that redacted artefact against the
// real value used to reject the entire request, blocking even an
// unrelated edit (e.g. a phone number change). The fix: skip the diff
// entirely for such a caller in diff-aware mode (`current` passed).
describe("findRejectedMoneyWrite / findRejectedField (money-blind caller, diff-aware mode)", () => {
  it("never rejects a dayPrice write, however different from the persisted value", () => {
    expect(
      findRejectedMoneyWrite({ dayPrice: 0, name: "Alice" }, access("geen"), { dayPrice: 450 }),
    ).toBeNull();
  });

  it("never rejects on create either, even for a large non-zero value", () => {
    expect(findRejectedMoneyWrite({ dayPrice: 99999 }, access("geen"))).toBeNull();
  });

  it("never rejects even on unparseable input — the value is never written either way", () => {
    expect(
      findRejectedMoneyWrite({ dayPrice: "not-a-number" }, access("geen"), { dayPrice: 300 }),
    ).toBeNull();
  });

  // Legacy strict-presence mode (`current` omitted) is deliberately NOT
  // covered by the money-blind bypass — those endpoints
  // (periods/[id]/{materials,people}/[assignmentId]) have no write-side
  // stripping to fall back on, so presence must keep rejecting for a
  // money-blind caller exactly as it does for a money-visible one, or
  // the value would sail through unwritten-around into the Prisma write.
  it("still rejects in legacy strict-presence mode for a money-blind caller (no write-side stripping there)", () => {
    expect(
      findRejectedField({ discountPct: 999 }, access("geen"), ["discountPct", "discountAmount"]),
    ).toBe("discountPct");
  });

  // N5.1b — scope: "own" forces money-blind regardless of the matrix's
  // own kosten_facturen level (redact.ts's moneyVisible).
  it("never rejects for scope: own, even with kosten_facturen: wijzigen granted", () => {
    expect(
      findRejectedMoneyWrite({ dayPrice: 0 }, access("wijzigen", "own"), { dayPrice: 450 }),
    ).toBeNull();
  });
});

describe("moneyFieldsToIgnore", () => {
  const FIELDS = ["dayPrice", "setupCost"] as const;

  it("returns every field for a money-blind caller", () => {
    expect(moneyFieldsToIgnore(access("geen"), FIELDS)).toEqual(new Set(FIELDS));
  });

  it("returns every field for scope: own regardless of kosten_facturen level", () => {
    expect(moneyFieldsToIgnore(access("verwijderen", "own"), FIELDS)).toEqual(new Set(FIELDS));
  });

  it("returns an empty set for a money-visible-but-not-writable caller", () => {
    expect(moneyFieldsToIgnore(access("lezen"), FIELDS)).toEqual(new Set());
  });

  it("returns an empty set for a caller with Kosten/Facturen: wijzigen", () => {
    expect(moneyFieldsToIgnore(access("wijzigen"), FIELDS)).toEqual(new Set());
  });
});

describe("findRejectedField (booking PATCH field-level checks, N2.2)", () => {
  const PERSON_KOSTEN_FIELDS = ["discountPct", "discountAmount"] as const;
  const MATERIAL_KOSTEN_FIELDS = ["discountPct", "discountAmount", "resnapshotPrice"] as const;

  it("a caller without Kosten access can still edit role on a person booking", () => {
    expect(
      findRejectedField({ role: "Regisseur" }, access("lezen"), PERSON_KOSTEN_FIELDS),
    ).toBeNull();
  });

  it("the same caller is rejected for discountPct on a person booking", () => {
    expect(
      findRejectedField({ role: "Regisseur", discountPct: 10 }, access("lezen"), PERSON_KOSTEN_FIELDS),
    ).toBe("discountPct");
  });

  it("a material booking PATCH also rejects resnapshotPrice without Kosten access", () => {
    expect(
      findRejectedField({ resnapshotPrice: true }, access("lezen"), MATERIAL_KOSTEN_FIELDS),
    ).toBe("resnapshotPrice");
  });

  it("a material booking PATCH with Kosten/Facturen: wijzigen allows all three fields", () => {
    expect(
      findRejectedField(
        { discountPct: 5, discountAmount: 10, resnapshotPrice: true },
        access("wijzigen"),
        MATERIAL_KOSTEN_FIELDS,
      ),
    ).toBeNull();
  });

  // Diff-aware mode (a `current` argument passed) — used by
  // PUT /api/functions/[id] for dayRate/hourRate, the same "always
  // resubmits the field" shape as findRejectedMoneyWrite. Passing no
  // `current` at all (the calls above) keeps the legacy strict-presence
  // behaviour untouched for the booking PATCH routes. All use "lezen"
  // (money-visible) — a money-blind caller is covered separately above.
  const RATE_FIELDS = ["dayRate", "hourRate"] as const;

  it("diff mode: allows an unchanged dayRate echo against the persisted function row", () => {
    expect(
      findRejectedField({ name: "Rigger", dayRate: 320 }, access("lezen"), RATE_FIELDS, { dayRate: 320, hourRate: null }),
    ).toBeNull();
  });

  it("diff mode: still rejects a genuine dayRate change", () => {
    expect(
      findRejectedField({ dayRate: 400 }, access("lezen"), RATE_FIELDS, { dayRate: 320, hourRate: null }),
    ).toBe("dayRate");
  });

  it("diff mode with current: null (create): allows an omitted-as-null rate, rejects a real one", () => {
    expect(findRejectedField({ dayRate: null }, access("lezen"), RATE_FIELDS, null)).toBeNull();
    expect(findRejectedField({ dayRate: 250 }, access("lezen"), RATE_FIELDS, null)).toBe("dayRate");
  });
});
