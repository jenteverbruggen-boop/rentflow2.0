import { describe, it, expect } from "vitest";
import { parseNumber } from "@/lib/import/parse-number";

describe("parseNumber", () => {
  it.each([
    ["0.38", 0.38], ["230", 230], ["278.3", 278.3], ["1.234,56", 1234.56], ["0,38", 0.38],
    ["0.4598", 0.4598], ["", null], ["abc", null],
  ])("%s -> %s", (input, expected) => expect(parseNumber(input)).toBe(expected));
});
