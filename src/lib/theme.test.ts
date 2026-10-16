import { describe, it, expect } from "vitest";
import { parseTheme, DEFAULT_THEME } from "@/lib/theme";

describe("parseTheme", () => {
  it("accepts exactly light and dark", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });
  it("rejects anything else", () => {
    for (const v of ["system", "", "DARK", null, undefined, 1, {}]) expect(parseTheme(v)).toBeNull();
  });
  it("defaults to dark, like the pre-paint script", () => {
    expect(DEFAULT_THEME).toBe("dark");
  });
});
