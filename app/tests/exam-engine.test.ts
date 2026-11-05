// Milestone 3C mock-exam engine: question choice, the wall-clock timer, navigation timing, submission and
// timeout, written answers marked afterwards, results computed from the record, and storage of records.
import { describe, expect, test } from "vitest";
import { loadBundle } from "../../tools/content_loader.ts";
import { buildCatalog } from "../src/content/catalog";
import { buildIndexes } from "../src/content/indexes";
import { emptyDraft, type Draft } from "../src/domain/answer";
import {
  examCounts, examQuestions, examResults, formatClock, goTo, isActiveExam, isExpired, markExamItem, questionState, remainingMs,
  resumeExam, setAnswer, startExam, submitExam, toggleReview, type ExamConfig,
} from "../src/domain/exam";
import { emptyProgress, saveExamRecord } from "../src/domain/progress";
import { decodeSaved, encodeSaved, examRecord } from "../src/store/persistence";

const bundle = loadBundle();
const stubs = buildCatalog(bundle).questions;
const idx = buildIndexes(bundle);
const Q = (id: string) => idx.question(id)!;
const unitOrder = [...bundle.curriculum.core.map((u) => u.id), ...bundle.curriculum.supplementary.map((u) => u.id)];
const cfg = (p: Partial<ExamConfig> = {}): ExamConfig => ({ units: [], difficulties: [], count: 10, minutes: 10, includeWritten: false, seed: 5, ...p });
const MIN = 60_000;
const T0 = 1_000_000;
// numeric (2 marks, answer 3.5), true/false (1, false), mcq (1, option 0), derivation (2, rubric 2 × 1)
const IDS = ["ch02-q002", "ch04-q007", "ch02-q008", "ch03-q006"];
const begin = () => startExam("e1", "Test exam", cfg({ includeWritten: true }), IDS, Q, T0);
const with_ = (d: Draft, p: Partial<Draft>): Draft => ({ ...d, ...p, touched: true });

describe("choosing exam questions", () => {
  const p = emptyProgress();
  test("written answers are left out unless asked for; supplementary only when chosen", () => {
    const auto = examQuestions(stubs, cfg({ count: 100 }), p, unitOrder).map((id) => idx.question(id)!);
    expect(auto.every((q) => q.type !== "derivation" && q.type !== "short-answer")).toBe(true);
    expect(auto.every((q) => !q.unit.startsWith("sup-"))).toBe(true);
    const withWritten = examQuestions(stubs, cfg({ count: 100, includeWritten: true }), p, unitOrder);
    expect(withWritten.length - auto.length).toBe(4); // ch02-q010, ch02-q011, ch03-q005, ch03-q006
    expect(examQuestions(stubs, cfg({ units: ["sup-zhao-06"], count: 100 }), p, unitOrder).sort()).toEqual(["sup-zhao-06-q001", "sup-zhao-06-q002"]);
  });
  test("chapters, difficulty and count apply; the same seed gives the same paper", () => {
    const a = examQuestions(stubs, cfg({ units: ["ch02"], difficulties: [1, 2], count: 5 }), p, unitOrder);
    expect(a).toHaveLength(5);
    expect(a.every((id) => id.startsWith("ch02") && [1, 2].includes(idx.question(id)!.difficulty))).toBe(true);
    expect(examQuestions(stubs, cfg({ units: ["ch02"], difficulties: [1, 2], count: 5 }), p, unitOrder)).toEqual(a);
  });
});

describe("the timer", () => {
  test("the deadline is fixed at the start; time left is wall-clock based", () => {
    const e = begin();
    expect(e.deadline).toBe(T0 + 10 * MIN);
    expect(remainingMs(e, T0 + 3 * MIN)).toBe(7 * MIN);
    expect(remainingMs(e, T0 + 11 * MIN)).toBe(0);
    expect(isExpired(e, T0 + 10 * MIN)).toBe(true);
  });
  test("navigation does not change the deadline and credits time to the question on screen", () => {
    let e = begin();
    e = goTo(e, 2, T0 + 30_000);
    e = goTo(e, 0, T0 + 50_000);
    expect(e.deadline).toBe(T0 + 10 * MIN);
    expect(e.ms["ch02-q002"]).toBe(30_000);
    expect(e.ms["ch02-q008"]).toBe(20_000);
    expect(e.visited).toEqual(["ch02-q002", "ch02-q008"]);
  });
  test("after a reload the time away is not credited to a question, but the clock kept running", () => {
    let e = begin();
    e = resumeExam(e, T0 + 4 * MIN); // the page was closed for 4 minutes
    e = goTo(e, 1, T0 + 4 * MIN + 10_000);
    expect(e.ms["ch02-q002"]).toBe(10_000);
    expect(remainingMs(e, T0 + 4 * MIN + 10_000)).toBe(6 * MIN - 10_000);
  });
  test("durations outside 1–180 minutes are refused", () => {
    expect(() => startExam("x", "x", cfg({ minutes: 0 }), IDS, Q, T0)).toThrow(/Duration/);
    expect(() => startExam("x", "x", cfg({ minutes: 181 }), IDS, Q, T0)).toThrow(/Duration/);
    expect(() => startExam("x", "x", cfg(), [], Q, T0)).toThrow(/at least one question/);
  });
  test("formatClock rounds up to whole seconds", () => {
    expect(formatClock(10 * MIN)).toBe("10:00");
    expect(formatClock(59_001)).toBe("01:00");
    expect(formatClock(1)).toBe("00:01");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(75 * MIN)).toBe("1:15:00");
  });
});

describe("answering and states", () => {
  test("answered, unanswered and not visited are told apart; review marks are exam-local", () => {
    let e = begin();
    e = setAnswer(e, "ch02-q002", with_(e.drafts["ch02-q002"], { texts: ["3.5"] }), T0 + 1000);
    e = goTo(e, 1, T0 + 2000);
    e = toggleReview(e, "ch04-q007");
    expect(questionState(e, Q("ch02-q002"))).toBe("answered");
    expect(questionState(e, Q("ch04-q007"))).toBe("unanswered");
    expect(questionState(e, Q("ch02-q008"))).toBe("not-visited");
    expect(examCounts(e, Q)).toEqual({ answered: 1, unanswered: 3, review: 1 });
    expect(toggleReview(e, "ch04-q007").review).toEqual([]);
  });
  test("answers cannot change once time is up", () => {
    const e = begin();
    expect(setAnswer(e, "ch02-q002", emptyDraft(Q("ch02-q002")), T0 + 10 * MIN)).toBe(e);
  });
});

describe("submission", () => {
  const answered = () => {
    let e = begin();
    e = setAnswer(e, "ch02-q002", with_(e.drafts["ch02-q002"], { texts: ["3.5"] }), T0); // right, 2 marks
    e = goTo(e, 1, T0 + 60_000);
    e = setAnswer(e, "ch04-q007", with_(e.drafts["ch04-q007"], { tf: true }), T0 + 60_000); // wrong (false)
    e = toggleReview(e, "ch04-q007");
    e = goTo(e, 3, T0 + 90_000);
    e = setAnswer(e, "ch03-q006", with_(e.drafts["ch03-q006"], { text: "v = sum of pi q" }), T0 + 90_000);
    // ch02-q008 is left unanswered
    return e;
  };
  test("grades auto-marked answers, leaves written ones for self-marking and records only what was answered", () => {
    const { record, attempts } = submitExam(answered(), Q, T0 + 5 * MIN);
    expect(record).toMatchObject({ id: "e1", endedBy: "submitted", submittedAt: T0 + 5 * MIN, elapsedMs: 5 * MIN, limitMs: 10 * MIN });
    const by = Object.fromEntries(record.items.map((x) => [x.qid, x]));
    expect(by["ch02-q002"]).toMatchObject({ answered: true, score: 2, max: 2, ms: 60_000 });
    expect(by["ch04-q007"]).toMatchObject({ answered: true, score: 0, markedForReview: true, ms: 30_000 });
    expect(by["ch02-q008"]).toMatchObject({ answered: false, score: 0 });
    expect(by["ch03-q006"]).toMatchObject({ answered: true, awaitingMark: true, selfMarked: true, score: 0, ms: 210_000 });
    expect(attempts.map((a) => [a.qid, a.score, a.mode, a.sessionId])).toEqual([["ch02-q002", 2, "exam", "e1"], ["ch04-q007", 0, "exam", "e1"]]);
  });
  test("an exam found after its deadline counts as timed out at the deadline, never later", () => {
    const { record, attempts } = submitExam(answered(), Q, T0 + 60 * MIN);
    expect(record).toMatchObject({ endedBy: "timeout", submittedAt: T0 + 10 * MIN, elapsedMs: 10 * MIN });
    expect(record.items.reduce((t, x) => t + x.ms, 0)).toBe(10 * MIN);
    expect(attempts.every((a) => a.at === T0 + 10 * MIN)).toBe(true);
  });
  test("results are computed from the record: score, accuracy, lists and breakdowns", () => {
    const { record } = submitExam(answered(), Q, T0 + 5 * MIN);
    const r = examResults(record);
    expect(r).toMatchObject({ score: 2, max: 6, answered: 3, correct: 1, incorrect: ["ch04-q007"], unattempted: ["ch02-q008"], awaitingMark: ["ch03-q006"], reviewFlagged: ["ch04-q007"], endedBy: "submitted" });
    expect(r.percent).toBeCloseTo(2 / 6);
    expect(r.accuracy).toBeCloseTo(2 / 3); // marked answers only: 2 of 2 + 1
    expect(r.byUnit).toEqual([
      { key: "ch02", questions: 2, correct: 1, score: 2, max: 3 },
      { key: "ch03", questions: 1, correct: 0, score: 0, max: 2 },
      { key: "ch04", questions: 1, correct: 0, score: 0, max: 1 },
    ]);
    expect(r.byDifficulty.map((b) => [b.key, b.questions, b.score, b.max])).toEqual([["1", 3, 2, 4], ["2", 1, 0, 2]]); // q002, q007, q008 are Beginner; q006 Intermediate
    const topics = Object.fromEntries(r.byConcept.map((b) => [b.key, b]));
    for (const it of record.items) for (const c of it.concepts) expect(topics[c].questions).toBeGreaterThanOrEqual(1);
  });
  test("marking a written answer afterwards updates the record and logs one attempt", () => {
    const { record } = submitExam(answered(), Q, T0 + 5 * MIN);
    const q = Q("ch03-q006");
    const d = with_(record.items.find((x) => x.qid === q.id)!.draft as Draft, { ticks: [true, false] });
    const out = markExamItem(record, q, d, T0 + 20 * MIN);
    expect(out.attempt).toMatchObject({ qid: q.id, score: 1, max: 2, selfMarked: true, mode: "exam" });
    expect(examResults(out.record)).toMatchObject({ score: 3, awaitingMark: [], correct: 1 });
    expect(markExamItem(out.record, q, d, T0).attempt).toBeNull(); // only once
  });
  test("records, with the answers given, survive storage and export; replacing a record keeps one copy", () => {
    const { record } = submitExam(answered(), Q, T0 + 5 * MIN);
    expect(examRecord(JSON.parse(JSON.stringify(record)))).toEqual(record);
    let p = saveExamRecord(emptyProgress(), record);
    expect(p.activity[0]).toMatchObject({ kind: "test", ref: "e1" });
    p = saveExamRecord(p, { ...record, title: "renamed" });
    expect(p.exams).toHaveLength(1);
    expect(decodeSaved(encodeSaved(p)).exams[0].items.find((x) => x.qid === "ch02-q002")!.draft).toMatchObject({ texts: ["3.5"] });
    expect(examRecord({ ...record, items: [{ ...record.items[0], draft: [1, 2] }] })).toBeNull();
  });
  test("a stored exam is resumed only if it is well formed", () => {
    const e = begin();
    expect(isActiveExam(JSON.parse(JSON.stringify(e)))).toBe(true);
    expect(isActiveExam({ ...e, deadline: e.startedAt })).toBe(false);
    expect(isActiveExam({ ...e, current: 7 })).toBe(false);
    expect(isActiveExam({ ...e, ms: {} })).toBe(false);
  });
});
