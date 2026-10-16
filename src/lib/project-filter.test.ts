import { describe, it, expect } from "vitest";
import { filterProjects, hiddenByStatus } from "./project-filter";
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
    expect(filterProjects(projects, "open", "").map((p) => p.id)).toEqual([1, 4]);
  });
  it("shows a single closed state, or everything", () => {
    expect(filterProjects(projects, "afgerond", "").map((p) => p.id)).toEqual([2]);
    expect(filterProjects(projects, "all", "")).toHaveLength(4);
  });
  it("searches name, client, location, status and notes", () => {
    expect(filterProjects(projects, "all", "summer").map((p) => p.id)).toEqual([1]);
    expect(filterProjects(projects, "all", "oostende").map((p) => p.id)).toEqual([4]);
    expect(filterProjects(projects, "all", "hal 3").map((p) => p.id)).toEqual([4]);
    expect(filterProjects(projects, "all", "geannuleerd").map((p) => p.id)).toEqual([3]);
  });
  it("requires every word, in any order, case-insensitively", () => {
    expect(filterProjects(projects, "all", "BRUGGE kerst").map((p) => p.id)).toEqual([2]);
    expect(filterProjects(projects, "all", "brugge summer")).toHaveLength(0);
  });
  it("combines status filter and query", () => {
    expect(filterProjects(projects, "open", "brugge")).toHaveLength(0);
  });
});

describe("hiddenByStatus", () => {
  it("counts matches the status filter hides", () => {
    expect(hiddenByStatus(projects, "open", "")).toBe(2);
    expect(hiddenByStatus(projects, "open", "brugge")).toBe(2);
    expect(hiddenByStatus(projects, "all", "brugge")).toBe(0);
  });
});
