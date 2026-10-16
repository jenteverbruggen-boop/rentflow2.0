import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.stubEnv("DATABASE_URL", `file:/tmp/notes-init.db`);
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { prisma as mockedPrisma } from "@/lib/prisma";
import { listNotes, getNote, createNote, updateNote } from "@/lib/notes";
import { setAssigneeDone, findMissingPersonIds } from "@/lib/note-assignees";

const DB_PATH = path.join(os.tmpdir(), `notes-${process.pid}.db`);
const DB_URL = `file:${DB_PATH}`;

let client: PrismaClient;
const ids = { author: 0, alice: 0, bob: 0, carol: 0, mine: 0, theirs: 0, clientId: 0 };
const n: Record<string, number> = {};

const aliceOwn = () => ({ scope: "own" as const, personId: ids.alice });
const manager = { scope: "all" as const, personId: null };

beforeAll(async () => {
  execSync(`DATABASE_URL=${DB_URL} npx prisma db push --schema=prisma/schema.dev.prisma`, { stdio: "pipe" });
  client = new PrismaClient({ adapter: new PrismaLibSql({ url: DB_URL }) } as never);
  Object.assign(mockedPrisma as object, client);

  ids.alice = (await client.person.create({ data: { name: "Alice", dayPrice: 1 } })).id;
  ids.bob = (await client.person.create({ data: { name: "Bob", dayPrice: 1 } })).id;
  ids.carol = (await client.person.create({ data: { name: "Carol", dayPrice: 1 } })).id;
  ids.clientId = (await client.client.create({ data: { name: "Klant" } })).id;
  const mk = async (name: string, withAlice: boolean) => {
    const p = await client.project.create({ data: { name, startDate: new Date("2026-11-01"), endDate: new Date("2026-11-02") } });
    const period = await client.period.create({ data: { projectId: p.id, name: "P", startDate: new Date("2026-11-01"), endDate: new Date("2026-11-02") } });
    if (withAlice) await client.periodPerson.create({ data: { periodId: period.id, personId: ids.alice, dayPriceSnapshot: 1 } });
    return p.id;
  };
  ids.mine = await mk("Mijn project", true);
  ids.theirs = await mk("Ander project", false);

  const role = await client.role.create({ data: { key: "NOTES_TEST", label: "Notes test", scope: "all" } });
  const author = await client.user.create({ data: { email: "author@test.dev", password: "x", name: "Author", roleId: role.id } });
  ids.author = author.id;
  const base = { noteDate: new Date(), createdById: author.id, createdByName: "Author", clientId: null as number | null };
  n.onMine = (await createNote({ ...base, title: "tent op mijn project", body: "b", projectId: ids.mine })).id;
  n.onTheirs = (await createNote({ ...base, title: "tent op ander project", body: "b", projectId: ids.theirs })).id;
  n.clientNoteForAlice = (await createNote({ ...base, title: "tent klantnotitie", body: "b", projectId: null, clientId: ids.clientId, assigneeIds: [ids.alice, ids.bob] })).id;
  n.unlinked = (await createNote({ ...base, title: "tent los", body: "b", projectId: null })).id;
}, 60_000);

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(DB_PATH, { force: true });
});

const titles = (notes: { id: number }[]) => notes.map((x) => x.id).sort();

describe("scope own visibility (C4)", () => {
  it("sees notes on own projects and notes assigned to them, nothing else", async () => {
    const seen = await listNotes({}, aliceOwn());
    expect(titles(seen)).toEqual([n.onMine, n.clientNoteForAlice].sort());
  });

  it("a search term can't widen what a scoped user sees", async () => {
    // All four notes match "tent". Before the AND fix the search OR replaced
    // the visibility clause and Alice would have received all four.
    const seen = await listNotes({ q: "tent" }, aliceOwn());
    expect(titles(seen)).toEqual([n.onMine, n.clientNoteForAlice].sort());
    expect(titles(await listNotes({ q: "tent" }, manager))).toHaveLength(4);
  });

  it("getNote (and so the image routes) honours an assignment, and still hides the rest", async () => {
    expect(await getNote(n.clientNoteForAlice, aliceOwn())).not.toBeNull();
    expect(await getNote(n.onTheirs, aliceOwn())).toBeNull();
    expect(await getNote(n.unlinked, aliceOwn())).toBeNull();
  });

  it("a scoped user with no linked person sees nothing, even with assignedToMe", async () => {
    const nobody = { scope: "own" as const, personId: null };
    expect(await listNotes({}, nobody)).toEqual([]);
    expect(await listNotes({ assignedToMe: true }, nobody)).toEqual([]);
    expect(await getNote(n.clientNoteForAlice, nobody)).toBeNull();
  });
});

describe("assignees and done state", () => {
  it("assignedToMe lists exactly my notes, and open hides the ones I ticked off", async () => {
    expect(titles(await listNotes({ assignedToMe: true }, aliceOwn()))).toEqual([n.clientNoteForAlice]);
    expect(await setAssigneeDone(n.clientNoteForAlice, ids.alice, true)).toBe(true);
    expect(await listNotes({ assignedToMe: true, open: true }, aliceOwn())).toEqual([]);
    expect(titles(await listNotes({ assignedToMe: true }, aliceOwn()))).toEqual([n.clientNoteForAlice]);
    expect(await setAssigneeDone(n.clientNoteForAlice, ids.alice, false)).toBe(true);
  });

  it("only an actual assignee can tick a note", async () => {
    expect(await setAssigneeDone(n.clientNoteForAlice, ids.carol, true)).toBe(false);
  });

  it("editing a note keeps the done state of assignees who stay, adds and removes the rest", async () => {
    await setAssigneeDone(n.clientNoteForAlice, ids.bob, true);
    const updated = await updateNote(n.clientNoteForAlice, {
      assigneeIds: [ids.bob, ids.carol], updatedById: ids.author, updatedByName: "Author",
    });
    const byName = Object.fromEntries(updated.assignees.map((a) => [a.personName, a.doneAt]));
    expect(Object.keys(byName).sort()).toEqual(["Bob", "Carol"]);
    expect(byName.Bob).not.toBeNull();
    expect(byName.Carol).toBeNull();
  });

  it("leaving assigneeIds out keeps them; [] clears them", async () => {
    const kept = await updateNote(n.clientNoteForAlice, { title: "nieuwe titel", updatedById: ids.author, updatedByName: "Author" });
    expect(kept.assignees).toHaveLength(2);
    const cleared = await updateNote(n.clientNoteForAlice, { assigneeIds: [], updatedById: ids.author, updatedByName: "Author" });
    expect(cleared.assignees).toEqual([]);
  });

  it("deleting a person drops their assignment", async () => {
    await updateNote(n.onMine, { assigneeIds: [ids.carol], updatedById: ids.author, updatedByName: "Author" });
    await client.person.delete({ where: { id: ids.carol } });
    expect((await getNote(n.onMine, manager))!.assignees).toEqual([]);
  });

  it("reports unknown person ids", async () => {
    expect(await findMissingPersonIds([ids.alice, 999999])).toEqual([999999]);
    expect(await findMissingPersonIds([])).toEqual([]);
  });
});
