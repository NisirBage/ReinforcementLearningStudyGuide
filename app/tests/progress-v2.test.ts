// Progress format version 2 (Milestone 3A): bookmarks, exam records, attempt mode and time.
// Version 1 saves and exports must still load, losing nothing they contained.
import { describe, expect, test } from "vitest";
import { emptyProgress, recordAttempt, toggleBookmark, toggleMarked, type ExamRecord } from "../src/domain/progress";
import { SCHEMA_VERSION, decodeSaved, encodeSaved, examRecord, exportProgress, mergeProgress, migrate, parseImport } from "../src/store/persistence";
import { loadFromStore, memoryStore, saveToStore } from "../src/store/idb";
import { STORAGE_KEY } from "../src/store/persistence";

const v1Data = {
  conceptStatus: { "ch02.action-value": { status: "learning", at: 5 } },
  attempts: [{ qid: "ch02-q001", unit: "ch02", concepts: ["ch02.action-value"], score: 2, max: 3, at: 10 }],
  marked: ["ch02-q001"],
  cards: {},
  activity: [{ at: 10, kind: "attempt", ref: "ch02-q001", detail: "2/3" }],
  lastVisited: null,
  settings: { theme: "dark", show2018Notation: true },
};

const exam = (id: string, startedAt: number): ExamRecord => ({
  id,
  title: "Chapter 2 mock",
  startedAt,
  submittedAt: startedAt + 60_000,
  limitMs: 600_000,
  elapsedMs: 60_000,
  endedBy: "submitted",
  config: { units: ["ch02"], difficulties: [1, 2], count: 1 },
  items: [{ qid: "ch02-q002", unit: "ch02", section: "2.4", concepts: ["ch02.constant-step"], difficulty: 2, max: 2, score: 2, answered: true, markedForReview: false, selfMarked: false, ms: 60_000 }],
});

describe("schema version 2", () => {
  test("is the current version", () => expect(SCHEMA_VERSION).toBe(2));

  test("a fresh profile has empty bookmarks and exams", () => {
    expect(emptyProgress().bookmarks).toEqual([]);
    expect(emptyProgress().exams).toEqual([]);
  });

  test("a version 1 save loads with everything it had, plus empty new fields", () => {
    const d = decodeSaved(JSON.stringify({ schema: 1, savedAt: 1, data: v1Data }));
    expect(d.attempts).toEqual(v1Data.attempts);
    expect(d.marked).toEqual(["ch02-q001"]);
    expect(d.conceptStatus).toEqual(v1Data.conceptStatus);
    expect(d.settings).toEqual({ theme: "dark", show2018Notation: true });
    expect(d.bookmarks).toEqual([]);
    expect(d.exams).toEqual([]);
  });

  test("a version 1 export still imports", () => {
    const d = parseImport(JSON.stringify({ app: "rl-study-lab", schema: 1, exportedAt: "2026-11-04T00:00:00.000Z", data: v1Data }));
    expect(d.attempts).toHaveLength(1);
  });

  test("a version 1 profile in IndexedDB is read and re-saved as version 2", async () => {
    const kv = memoryStore({ [STORAGE_KEY]: JSON.stringify({ schema: 1, savedAt: 1, data: v1Data }) });
    const r = await loadFromStore(kv);
    expect(r.status).toBe("loaded");
    await saveToStore(kv, r.data, 2);
    expect(JSON.parse(kv.dump()[STORAGE_KEY]).schema).toBe(2);
  });

  test("attempt mode, time and self-marking survive a round trip; bad values are dropped", () => {
    let p = recordAttempt(emptyProgress(), { qid: "a", unit: "ch02", concepts: [], score: 1, max: 2, at: 1, mode: "practice", ms: 4200, selfMarked: true, sessionId: "s1" });
    p = recordAttempt(p, { qid: "b", unit: "ch02", concepts: [], score: 1, max: 1, at: 2 });
    const back = decodeSaved(encodeSaved(p));
    expect(back.attempts[0]).toEqual({ qid: "a", unit: "ch02", concepts: [], score: 1, max: 2, at: 1, mode: "practice", ms: 4200, selfMarked: true, sessionId: "s1" });
    expect(back.attempts[1]).toEqual({ qid: "b", unit: "ch02", concepts: [], score: 1, max: 1, at: 2 });
    const odd = migrate({ attempts: [{ qid: "c", unit: "ch02", concepts: [], score: 1, max: 1, at: 3, mode: "cheating", ms: -5 }] });
    expect(odd.attempts[0]).toEqual({ qid: "c", unit: "ch02", concepts: [], score: 1, max: 1, at: 3 });
  });

  test("bookmarks are separate from revision flags", () => {
    let p = toggleBookmark(emptyProgress(), "ch02-q002");
    p = toggleMarked(p, "ch02-q005");
    expect(p.bookmarks).toEqual(["ch02-q002"]);
    expect(p.marked).toEqual(["ch02-q005"]);
    expect(toggleBookmark(p, "ch02-q002").bookmarks).toEqual([]);
    expect(decodeSaved(encodeSaved(p)).bookmarks).toEqual(["ch02-q002"]);
  });

  test("exam records survive a round trip", () => {
    const p = { ...emptyProgress(), exams: [exam("e1", 100)] };
    expect(decodeSaved(encodeSaved(p)).exams).toEqual([exam("e1", 100)]);
    expect(parseImport(exportProgress(p)).exams).toEqual([exam("e1", 100)]);
  });

  test("a malformed exam record is dropped whole, never kept in part", () => {
    const bad = [
      { ...exam("x1", 1), items: [] },
      { ...exam("x2", 1), endedBy: "abandoned" },
      { ...exam("x3", 1), items: [{ ...exam("x3", 1).items[0], score: 5 }] }, // score above max
      { ...exam("x4", 1), submittedAt: 0 }, // submitted before it started
    ];
    for (const b of bad) expect(examRecord(b), b.id).toBeNull();
    expect(migrate({ exams: [...bad, exam("ok", 1)] }).exams.map((e) => e.id)).toEqual(["ok"]);
  });

  test("merging unites bookmarks and exams without duplicates", () => {
    const a = { ...emptyProgress(), bookmarks: ["q1"], exams: [exam("e1", 100)] };
    const b = { ...emptyProgress(), bookmarks: ["q2", "q1"], exams: [exam("e2", 50), exam("e1", 100)] };
    const m = mergeProgress(a, b);
    expect(m.bookmarks).toEqual(["q1", "q2"]);
    expect(m.exams.map((e) => e.id)).toEqual(["e2", "e1"]);
  });
});
