import { describe, it, expect } from "vitest";
import { buildNoteWhere, myPersonId, noteVisibility } from "@/lib/note-where";

const all = { scope: "all" as const, personId: null };
const own = (personId: number | null) => ({ scope: "own" as const, personId });

describe("buildNoteWhere (C4)", () => {
  it("an unfiltered manager query has no conditions", () => {
    expect(buildNoteWhere({}, all)).toEqual({});
  });

  it("keeps the search and the own-scope visibility in separate AND clauses", () => {
    const where = buildNoteWhere({ q: "tent" }, own(7));
    expect(where.AND).toHaveLength(2);
    // Neither clause may be top-level OR: the search used to own `where.OR`
    // and would have overwritten the visibility rule.
    expect(where).not.toHaveProperty("OR");
    expect(JSON.stringify(where.AND)).toContain('"personId":7');
    expect(JSON.stringify(where.AND)).toContain('"contains":"tent"');
  });

  it("a caller without a linked person can match nothing, never everything", () => {
    expect(myPersonId(own(null))).toBe(-1);
    const where = buildNoteWhere({ assignedToMe: true }, own(null));
    expect(JSON.stringify(where)).not.toContain("undefined");
    expect(JSON.stringify(where.AND)).toContain('"personId":-1');
    expect(JSON.stringify(buildNoteWhere({ assignedToMe: true }, all))).toContain('"personId":-1');
  });

  it("'open' narrows assigned-to-me to the unticked ones", () => {
    expect(JSON.stringify(buildNoteWhere({ assignedToMe: true, open: true }, own(3)))).toContain('"doneAt":null');
    expect(JSON.stringify(buildNoteWhere({ assignedToMe: true }, own(3)))).not.toContain("doneAt");
  });

  it("only managers can filter on someone else's assignments", () => {
    expect(JSON.stringify(buildNoteWhere({ assigneeId: 9 }, all))).toContain('"personId":9');
    expect(JSON.stringify(buildNoteWhere({ assigneeId: 9 }, own(3)))).not.toContain('"personId":9');
  });

  it("'niet gekoppeld' (unassigned) means no project and no client", () => {
    expect(buildNoteWhere({ unassigned: true }, all)).toEqual({ AND: [{ projectId: null, clientId: null }] });
  });

  it("an own-scope caller never gets the unlinked/client views", () => {
    const text = JSON.stringify(buildNoteWhere({ unassigned: true, clientId: 4 }, own(3)));
    expect(text).not.toContain('"clientId":4');
    expect(text).not.toContain('"clientId":null');
  });
});

describe("noteVisibility", () => {
  it("is open for scope all and project-or-assigned for scope own", () => {
    expect(noteVisibility(all)).toBeUndefined();
    const v = noteVisibility(own(5))!;
    expect(v.OR).toHaveLength(2);
  });
});
