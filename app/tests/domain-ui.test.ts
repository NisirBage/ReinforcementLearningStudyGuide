// Logic added with the interface: grading, content indexes, the IndexedDB store, the review queue.
import { describe, expect, test } from "vitest";
import { loadBundle } from "../../tools/content_loader.ts";
import { buildIndexes } from "../src/content/indexes";
import { gradeQuestion, parseNumber } from "../src/domain/grade";
import { emptyProgress, review, reviewQueue, setConceptStatus } from "../src/domain/progress";
import { STORAGE_KEY, encodeSaved } from "../src/store/persistence";
import { loadFromStore, memoryStore, saveToStore } from "../src/store/idb";

const b = loadBundle();
const ix = buildIndexes(b);
const q = (id: string) => ix.question(id)!;

describe("grading", () => {
  test("parseNumber accepts decimals, minus signs and fractions", () => {
    expect([parseNumber("3.5"), parseNumber("−15"), parseNumber("-7/4"), parseNumber(" .5 "), parseNumber("1e-3")]).toEqual([3.5, -15, -1.75, 0.5, 0.001]);
    expect([parseNumber(""), parseNumber("abc"), parseNumber("1/0"), parseNumber("3,5")]).toEqual([null, null, null, null]);
  });
  test("numeric: full marks within tolerance, nothing outside it", () => {
    expect(gradeQuestion(q("ch02-q002"), { type: "numeric", values: [3.5] })).toMatchObject({ score: 2, max: 2, correct: true });
    expect(gradeQuestion(q("ch02-q002"), { type: "numeric", values: [3.6] })).toMatchObject({ score: 0, correct: false });
    expect(gradeQuestion(q("ch02-q002"), { type: "numeric", values: [null] }).score).toBe(0);
  });
  test("multi-numeric: marks in proportion to correct parts", () => {
    const g = gradeQuestion(q("ch02-q001"), { type: "numeric", values: [6, 4, 5] });
    expect(g).toMatchObject({ score: 2, max: 3, correct: false, parts: [true, true, false] });
  });
  test("multi: all or nothing", () => {
    expect(gradeQuestion(q("ch02-q005"), { type: "multi", choices: [4, 0] }).correct).toBe(true);
    expect(gradeQuestion(q("ch02-q005"), { type: "multi", choices: [0] }).score).toBe(0);
    expect(gradeQuestion(q("ch02-q005"), { type: "multi", choices: [0, 4, 1] }).score).toBe(0);
  });
  test("true-false and ordering", () => {
    expect(gradeQuestion(q("ch02-q007"), { type: "true-false", value: false }).correct).toBe(true);
    expect(gradeQuestion(q("ch02-q007"), { type: "true-false", value: true }).correct).toBe(false);
    expect(gradeQuestion(q("ch04-q003"), { type: "ordering", order: [0, 1, 2, 3, 4] }).correct).toBe(true);
    expect(gradeQuestion(q("ch04-q003"), { type: "ordering", order: [1, 0, 2, 3, 4] })).toMatchObject({ score: 0, parts: [false, false, true, true, true] });
  });
  test("a response of the wrong shape scores zero", () => {
    expect(gradeQuestion(q("ch02-q002"), { type: "mcq", choice: 0 }).score).toBe(0);
  });
});

describe("content indexes", () => {
  test("section content follows the source references", () => {
    const s = ix.sectionContent("ch02", "2.3");
    expect(s.lesson?.title).toBe("Incremental implementation");
    expect(s.equations.map((e) => e.bookLabel)).toEqual(["(2.3)", "(2.4)"]);
    expect(s.questions.map((x) => x.id)).toEqual(["ch02-q001"]);
    expect(ix.sectionContent("ch04", "4.1").figures.map((f) => f.bookLabel)).toEqual(["Figure 4.2"]);
  });
  test("end-of-chapter exercises are chapter-level", () => {
    expect(ix.chapterLevel("ch04").questions.map((x) => x.id)).toEqual(["ch04-q001"]);
  });
  test("prerequisite chains and dependents", () => {
    expect(ix.prereqChain("ch04.iterative-policy-evaluation").map((c) => c.id)).toEqual([
      "ch04.policy-evaluation", "ch03.bellman-equation-v", "ch03.state-value-function", "ch03.return",
    ]);
    expect(ix.dependents("ch03.bellman-equation-v").map((c) => c.id)).toEqual(["ch04.policy-evaluation"]);
  });
  test("units: 15 core in draft order, supplementary after; the draft's empty chapters are flagged", () => {
    expect(ix.units.filter((u) => u.kind === "core").map((u) => u.id)).toEqual(Array.from({ length: 15 }, (_, i) => `ch${String(i + 1).padStart(2, "0")}`));
    expect(ix.unit("ch10")?.status).toBe("empty-in-draft");
    expect(ix.supplementsFor("2").map((s) => s.id)).toEqual(expect.arrayContaining(["sup-zhao-06", "sup-regret"]));
  });
  test("Zhao sections belong to supplementary units only", () => {
    expect(ix.sectionsOf("sup-zhao-06").every((s) => s.book === "zhao")).toBe(true);
    expect(ix.sectionsOf("ch02").every((s) => s.book === "sb")).toBe(true);
  });
});

describe("IndexedDB store logic (in-memory stand-in)", () => {
  test("fresh store, save, reload", async () => {
    const kv = memoryStore();
    expect((await loadFromStore(kv)).status).toBe("fresh");
    const p = setConceptStatus(emptyProgress(), "ch02.ucb", "learning", 5);
    expect(await saveToStore(kv, p, 9)).toBe(true);
    const r = await loadFromStore(kv);
    expect(r.status).toBe("loaded");
    expect(r.data).toEqual(p);
  });
  test("an older localStorage profile is moved in once", async () => {
    const kv = memoryStore();
    const old = setConceptStatus(emptyProgress(), "ch02.ucb", "mastered", 1);
    const r = await loadFromStore(kv, () => encodeSaved(old, 1), 2);
    expect(r.data).toEqual(old);
    expect(r.message).toMatch(/moved into this browser's database/);
    expect(kv.dump()[STORAGE_KEY]).toBeDefined();
    expect((await loadFromStore(kv, () => "{garbage")).status).toBe("loaded"); // the store now wins over legacy data
  });
  test("unreadable data is backed up, not lost", async () => {
    const kv = memoryStore({ [STORAGE_KEY]: "{broken" });
    const r = await loadFromStore(kv, undefined, 77);
    expect(r.status).toBe("recovered");
    expect(kv.dump()["rlsl:backup:77"]).toBe("{broken");
  });
  test("a failing store reports a failed save", async () => {
    const kv = { get: async () => undefined, set: async () => Promise.reject(new Error("quota")), del: async () => undefined };
    expect(await saveToStore(kv, emptyProgress())).toBe(false);
  });
});

describe("review queue", () => {
  test("due cards first, then up to the limit of new ones; future cards are left out", () => {
    const ids = ["a", "b", "c", "d"];
    let p = review(emptyProgress(), "a", 0, 0); // due after 1 day
    p = review(review(p, "b", 2, 0), "b", 2, 0); // due after 6 days
    const q2 = reviewQueue(p, ids, 2 * 86_400_000, 1);
    expect(q2).toEqual([{ id: "a", isNew: false }, { id: "c", isNew: true }]);
  });
});
