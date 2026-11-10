// Milestone 3B question engine: answer drafts, grading (tolerance, rubric), selection (filters, pools, seeded
// order, interleaving), per-question history and the practice-session state machine. All against the real bank.
import { describe, expect, test } from "vitest";
import { loadBundle } from "../../tools/content_loader.ts";
import { buildCatalog } from "../src/content/catalog";
import { buildIndexes } from "../src/content/indexes";
import type { Question } from "../src/content/schema";
import { emptyDraft, gradeDraft, isAnswered, moveStep, scrambledOrder, toResponse } from "../src/domain/answer";
import { gradeQuestion, parseNumber } from "../src/domain/grade";
import { bookOrder, defaultConfig, interleave, matchingQuestions, selectQuestions, type PracticeConfig } from "../src/domain/practice";
import { emptyProgress, incorrectQids, questionStats, recordAttempts, repeatedMistakes, timeSpentMs, type Attempt, type ProgressData } from "../src/domain/progress";
import { check, finish, goTo, isSession, markSelf, revealStep, setDraft, startSession, summarize } from "../src/domain/session";

const bundle = loadBundle();
const catalog = buildCatalog(bundle);
const idx = buildIndexes(bundle);
const Q = (id: string) => idx.question(id)!;
const stubs = catalog.questions;
const unitOrder = [...bundle.curriculum.core.map((u) => u.id), ...bundle.curriculum.supplementary.map((u) => u.id)];
const cfg = (p: Partial<PracticeConfig> = {}): PracticeConfig => ({ ...defaultConfig(42), count: 100, ...p });
const att = (qid: string, score: number, max: number, at: number, extra: Partial<Attempt> = {}): Attempt => ({ qid, unit: qid.replace(/-q\d+$/, ""), concepts: [], score, max, at, ...extra });

describe("the question bank", () => {
  const all = bundle.questionFiles.flatMap((f) => f.questions);
  test("covers every question type, all four difficulties and all four provenance kinds", () => {
    expect(new Set(all.map((q) => q.type))).toEqual(new Set(["mcq", "multi", "numeric", "multi-numeric", "ordering", "true-false", "derivation", "short-answer"]));
    expect(new Set(all.map((q) => q.difficulty))).toEqual(new Set([1, 2, 3, 4]));
    expect(new Set(all.map((q) => q.provenance.kind))).toEqual(new Set(["textbook-exercise", "textbook-derived", "generated", "supplementary"]));
  });
  test("textbook-exercise questions are exactly the reworded exercises 2.1–2.3, 2.5, 2.6, 3.1–3.6, 3.8–3.21, 4.1–4.4, 4.6–4.8, 4.10, 5.1–5.8, 5.10 and 6.1–6.11", () => {
    const ex = all.filter((q) => q.provenance.kind === "textbook-exercise").map((q) => (q.provenance as { exercise: string }).exercise).sort();
    // Exercise 2.4 is a programming exercise, done as a lab task (content/coverage/coverage.json), not a bank question;
    // Exercise 3.7 does not exist in the draft (a placeholder); Exercises 4.5, 4.9 and 5.9 are programming exercises done as lab tasks.
    expect(ex).toEqual(["2.1", "2.2", "2.3", "2.5", "2.6", "3.1", "3.10", "3.11", "3.12", "3.13", "3.14", "3.15", "3.16", "3.17", "3.18", "3.19", "3.2", "3.20", "3.21", "3.3", "3.4", "3.5", "3.6", "3.8", "3.9", "4.1", "4.10", "4.2", "4.3", "4.4", "4.6", "4.7", "4.8", "5.1", "5.10", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "6.1", "6.10", "6.11", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8", "6.9"]);
  });
  test("every self-marked question has a model answer and a rubric adding up to its marks", () => {
    for (const q of all.filter((x) => x.type === "derivation" || x.type === "short-answer")) {
      expect(typeof q.answer, q.id).toBe("string");
      expect(q.rubric!.reduce((s, r) => s + r.marks, 0), q.id).toBe(q.marks);
    }
  });
  test("every numeric answer key is the computed value within its tolerance", async () => {
    const { CHECKS } = await import("../src/content/checks");
    for (const q of all.filter((x) => x.parts)) {
      const got = (CHECKS[q.verification!.check!].run as () => number[])();
      q.parts!.forEach((p, i) => expect(Math.abs(got[i] - p.answer), `${q.id} part ${i}`).toBeLessThanOrEqual(p.tolerance + 1e-12));
    }
  });
});

describe("answers and grading", () => {
  test("an empty draft is unanswered for every type", () => {
    for (const q of bundle.questionFiles.flatMap((f) => f.questions)) expect(isAnswered(q, emptyDraft(q)), q.id).toBe(false);
  });
  test("an ordering question never starts solved, and moving a step counts as answering", () => {
    const q = Q("ch04-q003");
    expect(scrambledOrder(q)).not.toEqual([0, 1, 2, 3, 4]);
    const d = moveStep(emptyDraft(q), 1, -1);
    expect(isAnswered(q, d)).toBe(true);
    expect(moveStep(d, 0, -1)).toBe(d); // cannot move the first step up
  });
  test("numerical tolerance: inside and exactly at the tolerance pass, just beyond fails", () => {
    const q = Q("ch02-q016"); // 0.0387 ± 0.00005 and 0.3487 ± 0.00005
    const g = (a: string, b: string) => gradeDraft(q, { ...emptyDraft(q), texts: [a, b] });
    expect(g("0.038742", "0.348678").correct).toBe(true);
    expect(g("0.03875", "0.34865").correct).toBe(true); // both exactly at the edge
    expect(g("0.03876", "0.3487").parts).toEqual([false, true]);
    expect(g("0.03876", "0.3487").score).toBe(1); // proportional marks
  });
  test("typed numbers accept fractions and a typographic minus sign", () => {
    expect(parseNumber("−39/16")).toBeCloseTo(-2.4375);
    expect(parseNumber("1/0")).toBeNull();
    const q = Q("ch04-q005");
    expect(gradeDraft(q, { ...emptyDraft(q), texts: ["−39/16", "-2.875"] }).correct).toBe(true);
  });
  test("rubric self-marking adds the ticked points' marks", () => {
    const q = Q("ch02-q011"); // 4 points of 1 mark
    const d = { ...emptyDraft(q), ticks: [true, true, false, true] };
    expect(toResponse(q, d)).toEqual({ type: "rubric", ticks: [true, true, false, true] });
    expect(gradeDraft(q, d)).toMatchObject({ score: 3, max: 4, correct: false });
    expect(gradeDraft(q, { ...d, ticks: [true, true, true, true] }).correct).toBe(true);
  });
  test("a self-marked question without a rubric still uses one self-mark, clamped to the marks", () => {
    const q = { ...Q("ch02-q011"), rubric: undefined } as Question;
    expect(gradeQuestion(q, { type: "derivation", selfScore: 9 }).score).toBe(4);
  });
  test("multi-select is all or nothing; mcq and true-false need the exact answer", () => {
    const m = Q("ch02-q014"); // answer [0, 1, 4]
    expect(gradeDraft(m, { ...emptyDraft(m), choices: [0, 1, 4] }).correct).toBe(true);
    expect(gradeDraft(m, { ...emptyDraft(m), choices: [0, 1] }).score).toBe(0);
    const t = Q("ch04-q007"); // false
    expect(gradeDraft(t, { ...emptyDraft(t), tf: false }).correct).toBe(true);
  });
});

describe("selection", () => {
  const p = emptyProgress();
  test("by default only core questions are drawn; supplementary ones only when their module is chosen", () => {
    const core = matchingQuestions(stubs, cfg(), p, unitOrder);
    expect(core.every((q) => !q.unit.startsWith("sup-"))).toBe(true);
    expect(core).toHaveLength(stubs.filter((q) => !q.unit.startsWith("sup-")).length);
    expect(matchingQuestions(stubs, cfg({ units: ["sup-zhao-06"] }), p, unitOrder).map((q) => q.id)).toEqual(["sup-zhao-06-q002", "sup-zhao-06-q001"]); // §6.2.1 first, whole-chapter last
  });
  test("filters combine: chapter, section, topic, difficulty, type, provenance", () => {
    const ids = (c: Partial<PracticeConfig>) => matchingQuestions(stubs, cfg(c), p, unitOrder).map((q) => q.id);
    expect(ids({ units: ["ch02"], sections: ["2.6"] })).toEqual(["ch02-q004", "ch02-q014", "ch02-q033", "ch02-q034"]);
    expect(ids({ concepts: ["ch03.return"] })).toEqual(["ch03-q012", "ch03-q001", "ch03-q002", "ch03-q003", "ch03-q005", "ch03-q011", "ch03-q015"]); // §3.2, §3.3, §3.4
    expect(ids({ units: ["ch04"], difficulties: [1] })).toEqual(["ch04-q003", "ch04-q007", "ch04-q024", "ch04-q014", "ch04-q017", "ch04-q031", "ch04-q015"]); // §4.1, §4.3, §4.5, §4.6, §4.7
    expect(ids({ types: ["derivation", "short-answer"] })).toEqual([
      "ch02-q022", "ch02-q026", "ch02-q010", "ch02-q011", "ch02-q027", "ch02-q029", "ch02-q033", "ch02-q036",
      "ch03-q008", "ch03-q009", "ch03-q010", "ch03-q012", "ch03-q005", "ch03-q015", "ch03-q013", "ch03-q006", "ch03-q014", "ch03-q016",
      "ch03-q017", "ch03-q018", "ch03-q019", "ch03-q021", "ch03-q022", "ch03-q023", "ch03-q024",
      "ch04-q018", "ch04-q019", "ch04-q020", "ch04-q021", "ch04-q022", "ch04-q023",
      "ch05-q012", "ch05-q013", "ch05-q014", "ch05-q015", "ch05-q016", "ch05-q017", "ch05-q018", "ch05-q019", "ch05-q020",
      "ch06-q010", "ch06-q011", "ch06-q012", "ch06-q013", "ch06-q014", "ch06-q015", "ch06-q016",
    ]); // by section, then file order
    expect(ids({ provenance: ["textbook-exercise"] })).toEqual([
      "ch02-q023", "ch02-q026", "ch02-q027", "ch02-q029", "ch02-q040",
      "ch03-q008", "ch03-q009", "ch03-q010", "ch03-q012", "ch03-q005", "ch03-q011", "ch03-q015", "ch03-q013", "ch03-q004", "ch03-q006", "ch03-q014", "ch03-q016",
      "ch03-q017", "ch03-q018", "ch03-q019", "ch03-q020", "ch03-q021", "ch03-q022", "ch03-q023", "ch03-q024",
      "ch04-q001", "ch04-q004", "ch04-q018", "ch04-q019", "ch04-q020", "ch04-q021", "ch04-q022", "ch04-q023",
      "ch05-q012", "ch05-q013", "ch05-q014", "ch05-q015", "ch05-q016", "ch05-q017", "ch05-q018", "ch05-q019", "ch05-q020",
      "ch06-q010", "ch06-q009", "ch06-q011", "ch06-q012", "ch06-q013", "ch06-q007", "ch06-q008", "ch06-q014", "ch06-q006", "ch06-q015", "ch06-q016",
    ]); // §3.3 before §3.7
    expect(ids({ units: ["ch03"], provenance: ["generated"] })).toEqual([]);
  });
  test("book order sorts by chapter, then section numerically, then id", () => {
    const sorted = bookOrder(stubs.filter((q) => q.unit === "ch02"), unitOrder).map((q) => q.section);
    expect(sorted).toEqual([...sorted].sort((a, b) => Number(a!.split(".")[1]) - Number(b!.split(".")[1])));
  });
  test("the same seed gives the same questions in the same order; another seed reorders them", () => {
    const a = selectQuestions(stubs, cfg({ seed: 7, count: 10 }), p, unitOrder);
    expect(selectQuestions(stubs, cfg({ seed: 7, count: 10 }), p, unitOrder)).toEqual(a);
    expect(a).toHaveLength(10);
    expect(new Set(a).size).toBe(10); // no repeats
    expect(selectQuestions(stubs, cfg({ seed: 8, count: 10 }), p, unitOrder)).not.toEqual(a);
  });
  test("mixed-topic order alternates topics while more than one topic is left", () => {
    const qs = matchingQuestions(stubs, cfg(), p, unitOrder);
    const out = interleave(qs, 3);
    expect(new Set(out.map((q) => q.id))).toEqual(new Set(qs.map((q) => q.id)));
    const topic = (i: number) => `${out[i].unit}|${out[i].section}`;
    const topics = new Set(qs.map((q) => `${q.unit}|${q.section}`)).size;
    for (let i = 1; i < topics; i++) expect(topic(i), `position ${i}`).not.toBe(topic(i - 1));
  });
  test("pools use the learner's real history", () => {
    let prog: ProgressData = recordAttempts(emptyProgress(), [att("ch02-q002", 0, 2, 1), att("ch02-q002", 0, 2, 2), att("ch02-q001", 3, 3, 3), att("ch02-q005", 0, 3, 4), att("ch02-q005", 3, 3, 5)]);
    prog = { ...prog, bookmarks: ["ch03-q001"], marked: ["ch04-q002"] };
    const ids = (pool: PracticeConfig["pool"]) => matchingQuestions(stubs, cfg({ pool }), prog, unitOrder).map((q) => q.id);
    expect(ids("incorrect")).toEqual(["ch02-q002"]); // q005 was wrong, then right: not in the set
    expect(ids("repeated")).toEqual(["ch02-q002"]);
    expect(ids("bookmarked")).toEqual(["ch03-q001"]);
    expect(ids("flagged")).toEqual(["ch04-q002"]);
    expect(ids("unattempted")).not.toContain("ch02-q001");
    expect(ids("unattempted")).toHaveLength(ids("all").length - 3);
  });
});

describe("per-question history", () => {
  const list = [att("a", 0, 2, 1, { ms: 1000 }), att("a", 2, 2, 2, { ms: 500 }), att("b", 1, 2, 3), att("b", 0, 2, 4, { ms: 250 }), att("c", 1, 1, 5)];
  test("stats, latest-attempt incorrect set, repeated mistakes and time", () => {
    const s = questionStats(list);
    expect(s.get("a")).toMatchObject({ attempts: 2, correct: 1, wrong: 1, ms: 1500 });
    expect(incorrectQids(list)).toEqual(["b"]);
    expect(repeatedMistakes(list)).toEqual([{ qid: "b", wrong: 2, attempts: 2 }]);
    expect(timeSpentMs(list)).toBe(1750);
  });
  test("an invalid attempt in a batch is refused", () => {
    expect(() => recordAttempts(emptyProgress(), [att("a", 3, 2, 1)])).toThrow(/invalid score/);
  });
});

describe("practice session", () => {
  const ids = ["ch02-q002", "ch04-q003", "ch02-q011", "ch03-q007"];
  const start = (feedback: "immediate" | "deferred" = "immediate") => startSession("s1", cfg({ feedback }), ids, Q, 1000);
  test("time is added to the question on screen when moving between questions", () => {
    let s = start();
    s = goTo(s, 2, 4000); // 3 s on question 1
    s = goTo(s, 0, 4500); // 0.5 s on question 3
    expect(s.items["ch02-q002"].ms).toBe(3000);
    expect(s.items["ch02-q011"].ms).toBe(500);
    expect(s.current).toBe(0);
  });
  test("immediate feedback grades on check and returns an attempt with mode, time and session id", () => {
    let s = start();
    s = setDraft(s, "ch02-q002", { ...s.items["ch02-q002"].draft, texts: ["3.5"] });
    const r = check(s, Q("ch02-q002"), 6000);
    expect(r.session.items["ch02-q002"]).toMatchObject({ phase: "graded", grade: { score: 2, correct: true } });
    expect(r.attempt).toMatchObject({ qid: "ch02-q002", score: 2, max: 2, mode: "practice", sessionId: "s1", ms: 5000, at: 6000 });
    // A graded answer can no longer be changed.
    expect(setDraft(r.session, "ch02-q002", emptyDraft(Q("ch02-q002")))).toBe(r.session);
  });
  test("a self-marked question is revealed first and recorded only when the learner marks it", () => {
    let s = goTo(start(), 2, 2000);
    const q = Q("ch02-q011");
    const r = check(s, q, 3000);
    expect(r.attempt).toBeNull();
    expect(r.session.items[q.id].phase).toBe("revealed");
    s = r.session;
    const m = markSelf(s, q, { ...s.items[q.id].draft, ticks: [true, false, true, true] }, 9000);
    expect(m.attempt).toMatchObject({ score: 3, max: 4, selfMarked: true });
    expect(m.session.items[q.id].phase).toBe("graded");
  });
  test("step-by-step solution viewing reveals one step at a time, or all at once", () => {
    const q = Q("ch02-q011");
    let s = revealStep(start(), q.id, q);
    expect(s.items[q.id].steps).toBe(1);
    s = revealStep(s, q.id, q, true);
    expect(s.items[q.id].steps).toBe(q.solution.length);
    expect(revealStep(s, q.id, q).items[q.id].steps).toBe(q.solution.length); // never past the end
  });
  test("deferred feedback: finishing grades what was answered, reveals self-marked work, and leaves the rest unattempted", () => {
    let s = start("deferred");
    s = setDraft(s, "ch02-q002", { ...s.items["ch02-q002"].draft, texts: ["4"] }); // wrong (3.5)
    s = setDraft(s, "ch02-q011", { ...s.items["ch02-q011"].draft, text: "my working", touched: true });
    const r = finish(s, Q, 10_000);
    expect(r.attempts.map((a) => [a.qid, a.score])).toEqual([["ch02-q002", 0]]);
    expect(r.session.finishedAt).toBe(10_000);
    const sum = summarize(r.session, Q);
    expect(sum).toMatchObject({ questions: 4, graded: 1, correct: 0, incorrect: 1, unanswered: 2, awaitingMark: 1, score: 0, max: 2, wrongQids: ["ch02-q002"] });
    expect(sum.ms).toBe(9000);
  });
  test("a stored session is only resumed if it is well formed", () => {
    const s = start();
    expect(isSession(JSON.parse(JSON.stringify(s)))).toBe(true);
    expect(isSession({ ...s, qids: [] })).toBe(false);
    expect(isSession({ ...s, current: 9 })).toBe(false);
    expect(isSession(null)).toBe(false);
    expect(() => startSession("x", cfg(), [], Q, 0)).toThrow(/at least one question/);
  });
});
