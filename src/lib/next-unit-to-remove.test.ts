import { describe, it, expect } from "vitest";
import { nextUnitToRemove } from "@/lib/next-unit-to-remove";

const a = { id: 9 } as never;
const base = { overbookedUnits: 0, shortageIds: [], subhireIds: [], assignments: [] };

describe("nextUnitToRemove", () => {
  it("takes an open unit first", () => {
    expect(nextUnitToRemove({ ...base, overbookedUnits: 2, shortageIds: [1, 2], subhireIds: [7], assignments: [a] }))
      .toEqual({ kind: "open", shortageId: 2 });
  });
  it("then a hired-in unit", () => {
    expect(nextUnitToRemove({ ...base, subhireIds: [7, 8], assignments: [a] })).toEqual({ kind: "hired", shortageId: 8 });
  });
  it("then an owned unit", () => {
    expect(nextUnitToRemove({ ...base, assignments: [a] })).toEqual({ kind: "owned", assignmentId: 9 });
  });
  it("is null for an empty group", () => {
    expect(nextUnitToRemove(base)).toBeNull();
  });
});
