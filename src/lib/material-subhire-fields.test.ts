import { describe, it, expect } from "vitest";
import { subhireFieldsError } from "@/lib/material-subhire-fields";

const cur = { defaultSupplierId: 3, subhireOnly: false, isBundle: false, stockCount: 0 };

describe("subhireFieldsError (E4)", () => {
  it("needs a supplier for inhuur-only", () => {
    expect(subhireFieldsError({ subhireOnly: true })).toMatch(/standaardleverancier/);
    expect(subhireFieldsError({ subhireOnly: true, defaultSupplierId: 3 })).toBeNull();
  });
  it("refuses inhuur-only while stock items exist", () => {
    expect(subhireFieldsError({ subhireOnly: true }, { ...cur, stockCount: 2 })).toMatch(/units/);
    expect(subhireFieldsError({ subhireOnly: true }, cur)).toBeNull();
  });
  it("keeps a legacy inhuur-only row with stock saveable", () => {
    expect(subhireFieldsError({ subhireOnly: true, name: "x" }, { ...cur, subhireOnly: true, stockCount: 2 })).toBeNull();
  });
  it("refuses inhuur-only together with a set, either way round", () => {
    expect(subhireFieldsError({ subhireOnly: true }, { ...cur, isBundle: true })).toMatch(/set/);
    expect(subhireFieldsError({ isBundle: true }, { ...cur, subhireOnly: true })).toMatch(/set/);
    expect(subhireFieldsError({ subhireOnly: true, isBundle: true, defaultSupplierId: 3 })).toMatch(/set/);
  });
});
