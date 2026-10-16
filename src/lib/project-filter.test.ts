import { describe, it, expect } from "vitest";
import {
  ALL_STATUSES, OPEN_STATUSES, filterProjects, hiddenByStatus,
  parseStatusParam, serializeStatusParam, toggleStatus,
} from "./project-filter";
import type { Project } from "@/types";

const mk = (over: Partial<Project>): Project => ({
  id: 1, name: "Project", client: null, clientId: null, location: null, locationId: null,
  startDate: "2026-01-01", endDate: "2026-01-02", status: "concept", notes: null,
  createdAt: "2026-01-01", periods: [], materialPrices: [], personPrices: [], ...over,
});

const projects = [
  mk({ id: 1, name: "Zomerfeest", client: "Summer Sounds vzw", location: "Gent", status: "actief" }),
  mk({ id: 2, name: "Kerstmarkt", client: "Stad Brugge", location: "Brugge", status: "afgerond" }),
  mk({ id: 3, name: "Carnaval", client: "Stad Brugge", location: "Brugge", status: "geannuleerd" }),
  mk({ id: 4, name: "Expo", client: "Coastline", location: "Oostende", status: "bevestigd", notes: "Hal 3" }),
];

describe("filterProjects", () => {
  it("open (default) hides afgerond and geannuleerd", () => {
    expect(filterProjects(projects, OPEN_STATUSES, "").map((p) => p.id)).toEqual([1, 4]);
  });
  it("shows a single closed state, or everything", () => {
    expect(filterProjects(projects, ["afgerond"], "").map((p) => p.id)).toEqual([2]);
    expect(filterProjects(projects, ALL_STATUSES, "")).toHaveLength(4);
  });
  it("searches name, client, location, status and notes", () => {
    expect(filterProjects(projects, ALL_STATUSES, "summer").map((p) => p.id)).toEqual([1]);
    expect(filterProjects(projects, ALL_STATUSES, "oostende").map((p) => p.id)).toEqual([4]);
    expect(filterProjects(projects, ALL_STATUSES, "hal 3").map((p) => p.id)).toEqual([4]);
    expect(filterProjects(projects, ALL_STATUSES, "geannuleerd").map((p) => p.id)).toEqual([3]);
  });
  it("requires every word, in any order, case-insensitively", () => {
    expect(filterProjects(projects, ALL_STATUSES, "BRUGGE kerst").map((p) => p.id)).toEqual([2]);
    expect(filterProjects(projects, ALL_STATUSES, "brugge summer")).toHaveLength(0);
  });
  it("filters on any combination of single statuses", () => {
    expect(filterProjects(projects, ["concept"], "")).toHaveLength(0);
    expect(filterProjects(projects, ["bevestigd", "afgerond"], "").map((p) => p.id)).toEqual([2, 4]);
  });
  it("combines status filter and query", () => {
    expect(filterProjects(projects, OPEN_STATUSES, "brugge")).toHaveLength(0);
  });
});

describe("hiddenByStatus", () => {
  it("counts matches the status filter hides", () => {
    expect(hiddenByStatus(projects, OPEN_STATUSES, "")).toBe(2);
    expect(hiddenByStatus(projects, OPEN_STATUSES, "brugge")).toBe(2);
    expect(hiddenByStatus(projects, ALL_STATUSES, "brugge")).toBe(0);
  });
});

describe("status URL param", () => {
  it("absent means Lopend, all means everything", () => {
    expect(parseStatusParam(null)).toEqual(OPEN_STATUSES);
    expect(parseStatusParam("all")).toEqual(ALL_STATUSES);
  });
  it("parses a list in canonical order and drops unknown entries", () => {
    expect(parseStatusParam("afgerond,concept,bogus")).toEqual(["concept", "afgerond"]);
  });
  it("a mangled or empty value shows everything instead of nothing", () => {
    expect(parseStatusParam("")).toEqual(ALL_STATUSES);
    expect(parseStatusParam("bogus")).toEqual(ALL_STATUSES);
  });
  it("serializes the default to no param, everything to all", () => {
    expect(serializeStatusParam(OPEN_STATUSES)).toBeNull();
    expect(serializeStatusParam([...OPEN_STATUSES].reverse())).toBeNull();
    expect(serializeStatusParam(ALL_STATUSES)).toBe("all");
    expect(serializeStatusParam(["afgerond", "concept"])).toBe("concept,afgerond");
  });
  it("round-trips", () => {
    for (const set of [["concept"], ["bevestigd", "geannuleerd"], OPEN_STATUSES, ALL_STATUSES] as const) {
      expect(parseStatusParam(serializeStatusParam([...set]))).toEqual([...set]);
    }
  });
});

describe("toggleStatus", () => {
  it("adds and removes statuses", () => {
    expect(toggleStatus(["concept"], "afgerond")).toEqual(["concept", "afgerond"]);
    expect(toggleStatus(["concept", "afgerond"], "concept")).toEqual(["afgerond"]);
  });
  it("never empties the selection", () => {
    expect(toggleStatus(["concept"], "concept")).toEqual(["concept"]);
  });
});
