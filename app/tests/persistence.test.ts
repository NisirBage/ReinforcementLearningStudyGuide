// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest";
import { emptyProgress, recordAttempt, review, setConceptStatus, toggleMarked, visit, type ProgressData } from "../src/domain/progress";
import { STORAGE_KEY, exportProgress, loadProgress, mergeProgress, migrate, parseImport, saveProgress } from "../src/store/persistence";

const sample = (): ProgressData => {
  let p = emptyProgress();
  p = setConceptStatus(p, "ch02.ucb", "learning", 10);
  p = recordAttempt(p, { qid: "ch02-q004", unit: "ch02", concepts: ["ch02.ucb"], score: 3, max: 4, at: 11 });
  p = toggleMarked(p, "ch02-q004");
  p = review(p, "eq.ch02.ucb", 2, 12);
  p = visit(p, "/learn/ch02", "Multi-arm Bandits", 13);
  return { ...p, settings: { theme: "dark", show2018Notation: true } };
};

beforeEach(() => localStorage.clear());

describe("save and load", () => {
  test("a fresh browser starts with an empty profile (no fake progress)", () => {
    const r = loadProgress();
    expect(r.status).toBe("fresh");
    expect(r.data).toEqual(emptyProgress());
  });
  test("round-trips everything, so a page refresh loses nothing", () => {
    expect(saveProgress(sample())).toBe(true);
    const r = loadProgress();
    expect(r.status).toBe("loaded");
    expect(r.data).toEqual(sample());
  });
  test("unreadable data is kept under a backup key, never discarded", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    const r = loadProgress(STORAGE_KEY, 999);
    expect(r.status).toBe("recovered");
    expect(r.data).toEqual(emptyProgress());
    expect(localStorage.getItem("rlsl:backup:999")).toBe("{not json");
    expect(r.message).toMatch(/rlsl:backup:999/);
  });
  test("data saved by a newer app version is not overwritten silently", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schema: 99, savedAt: 1, data: {} }));
    const r = loadProgress(STORAGE_KEY, 5);
    expect(r.status).toBe("recovered");
    expect(r.message).toMatch(/newer version/);
    expect(localStorage.getItem("rlsl:backup:5")).not.toBeNull();
  });
});

describe("migrate", () => {
  test("keeps well-formed records and drops malformed ones", () => {
    const m = migrate({
      conceptStatus: { good: { status: "mastered", at: 1 }, bad: { status: "guru", at: 1 }, worse: "x" },
      attempts: [{ qid: "q", unit: "ch02", concepts: [], score: 1, max: 2, at: 3 }, { qid: "q", unit: "ch02", concepts: [], score: 5, max: 2, at: 3 }, null],
      marked: ["b", "a", "a", 7],
      cards: { c: { reps: 1, interval: 1, ease: 2.5, due: 9, lapses: 0 } },
      settings: { theme: "neon", show2018Notation: "yes" },
    });
    expect(Object.keys(m.conceptStatus)).toEqual(["good"]);
    expect(m.attempts).toHaveLength(1);
    expect(m.marked).toEqual(["a", "b"]);
    expect(m.cards.c.last).toBeNull(); // older saves had no last-review time
    expect(m.settings).toEqual({ theme: "system", show2018Notation: false });
  });
  test("anything that is not an object becomes an empty profile", () => {
    expect(migrate(null)).toEqual(emptyProgress());
    expect(migrate([1, 2])).toEqual(emptyProgress());
  });
});

describe("backup files", () => {
  test("export → import round-trips", () => {
    expect(parseImport(exportProgress(sample(), 0))).toEqual(sample());
  });
  test("rejects other apps' files and newer exports with a readable message", () => {
    expect(() => parseImport("nope")).toThrow("Not a JSON file.");
    expect(() => parseImport(JSON.stringify({ app: "nlp-study-lab", data: {} }))).toThrow(/not an RL Study Lab export/);
    expect(() => parseImport(JSON.stringify({ app: "rl-study-lab", schema: 3, data: {} }))).toThrow(/newer version/);
  });
  test("merge unites attempts without duplicates, newer status and review win, local settings stay", () => {
    const laptop = sample();
    let phone = emptyProgress();
    phone = setConceptStatus(phone, "ch02.ucb", "understood", 50); // newer than laptop's "learning" at 10
    phone = setConceptStatus(phone, "ch04.policy-evaluation", "learning", 5);
    phone = recordAttempt(phone, laptop.attempts[0]); // same attempt seen on both devices
    phone = recordAttempt(phone, { qid: "ch04-q001", unit: "ch04", concepts: [], score: 4, max: 4, at: 40 });
    phone = review(phone, "eq.ch02.ucb", 0, 60); // later review of the same card
    phone = { ...phone, settings: { theme: "light", show2018Notation: false } };
    const m = mergeProgress(laptop, phone);
    expect(m.attempts.map((a) => a.qid)).toEqual(["ch02-q004", "ch04-q001"]);
    expect(m.conceptStatus["ch02.ucb"].status).toBe("understood");
    expect(m.conceptStatus["ch04.policy-evaluation"].status).toBe("learning");
    expect(m.cards["eq.ch02.ucb"].last).toBe(60);
    expect(m.settings).toEqual(laptop.settings);
    expect(m.marked).toEqual(["ch02-q004"]);
    expect(mergeProgress(m, phone)).toEqual(m); // merging again changes nothing
  });
});
