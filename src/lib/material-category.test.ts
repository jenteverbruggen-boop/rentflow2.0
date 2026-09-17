import { describe, it, expect } from "vitest";
import { resolveLegacyCategoryName } from "@/lib/material-category";

describe("resolveLegacyCategoryName", () => {
  it("uses the resolved category row's name when categoryId is set", () => {
    expect(resolveLegacyCategoryName(3, "Oude naam", "Verlichting")).toBe(
      "Verlichting",
    );
  });

  it("ignores a stale submitted string once categoryId is set", () => {
    expect(resolveLegacyCategoryName(3, "Stale", "Nieuwe naam")).toBe(
      "Nieuwe naam",
    );
  });

  it("falls back to null when categoryId is set but the row wasn't found", () => {
    expect(resolveLegacyCategoryName(3, "Oude naam", undefined)).toBeNull();
    expect(resolveLegacyCategoryName(3, "Oude naam", null)).toBeNull();
  });

  it("keeps the legacy submitted string when categoryId is null", () => {
    expect(resolveLegacyCategoryName(null, "Losse tekst", "Verlichting")).toBe(
      "Losse tekst",
    );
  });

  it("keeps the legacy submitted string when categoryId is undefined", () => {
    expect(
      resolveLegacyCategoryName(undefined, "Losse tekst", "Verlichting"),
    ).toBe("Losse tekst");
  });

  it("returns null when categoryId is null and no legacy string was submitted", () => {
    expect(resolveLegacyCategoryName(null, null, undefined)).toBeNull();
    expect(resolveLegacyCategoryName(null, undefined, undefined)).toBeNull();
  });
});
