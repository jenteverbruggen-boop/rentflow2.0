import { describe, it, expect } from "vitest";
import { diffFunctionIds } from "./person-functions-diff";

describe("diffFunctionIds (L1.1)", () => {
  it("adds new ids and removes dropped ones, leaving unchanged ids in neither set", () => {
    const result = diffFunctionIds([1, 2], [2, 3]);
    expect(result).toEqual({ toAdd: [3], toRemove: [1] });
  });

  it("an unchanged set produces no add and no remove — the rate-preserving case", () => {
    const result = diffFunctionIds([1, 2], [1, 2]);
    expect(result).toEqual({ toAdd: [], toRemove: [] });
  });

  it("clearing every function removes all existing ids and adds none", () => {
    const result = diffFunctionIds([1, 2], []);
    expect(result).toEqual({ toAdd: [], toRemove: [1, 2] });
  });

  it("assigning the first functions adds all of them and removes none", () => {
    const result = diffFunctionIds([], [1, 2]);
    expect(result).toEqual({ toAdd: [1, 2], toRemove: [] });
  });
});
