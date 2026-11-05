// Mock examinations as pure data and transitions (Milestone 3C). No React and no clock: `now` is always passed in.
//
// The countdown is wall-clock based: an exam stores its `deadline` (epoch ms), so the time left is
// deadline − now wherever the learner is, after navigating away, and after a reload. An exam found past its
// deadline is submitted as "timeout" at the deadline itself, so a late reload never adds time.
// Results are computed from the stored ExamRecord only, never kept as separate totals.
import type { QuestionStub } from "../content/catalog";
import type { Question, QuestionType } from "../content/schema";
import { emptyDraft, gradeDraft, isAnswered, isSelfMarked, type Draft } from "./answer";
import { defaultConfig, selectQuestions } from "./practice";
import type { Attempt, ExamItem, ExamRecord, ProgressData } from "./progress";

export interface ExamConfig {
  units: string[]; // empty = every core chapter; supplementary modules only when listed
  difficulties: number[]; // empty = all
  count: number;
  minutes: number; // duration
  includeWritten: boolean; // derivations and short answers, self-marked after submission
  seed: number;
}

export const MIN_MINUTES = 1;
export const MAX_MINUTES = 180;
const WRITTEN: QuestionType[] = ["derivation", "short-answer"];
const AUTO: QuestionType[] = ["mcq", "multi", "numeric", "multi-numeric", "ordering", "true-false"];

export interface ActiveExam {
  id: string;
  title: string;
  config: ExamConfig;
  qids: string[];
  drafts: Record<string, Draft>;
  review: string[]; // marked for review (exam-local, separate from the revision flag)
  visited: string[];
  ms: Record<string, number>; // time each question was on screen
  current: number;
  startedAt: number;
  deadline: number;
  enteredAt: number;
}

type Lookup = (qid: string) => Question;

/** The questions an exam config matches (seeded random order), before cutting to `count`. */
export function examQuestions(stubs: QuestionStub[], cfg: ExamConfig, p: ProgressData, unitOrder: string[], count = cfg.count): string[] {
  return selectQuestions(
    stubs,
    { ...defaultConfig(cfg.seed), units: cfg.units, difficulties: cfg.difficulties, types: cfg.includeWritten ? [...AUTO, ...WRITTEN] : AUTO, pool: "all", order: "random", count },
    p,
    unitOrder,
  );
}

export function startExam(id: string, title: string, cfg: ExamConfig, qids: string[], q: Lookup, now: number): ActiveExam {
  if (qids.length === 0) throw new Error("An exam needs at least one question.");
  if (!(cfg.minutes >= MIN_MINUTES && cfg.minutes <= MAX_MINUTES)) throw new RangeError(`Duration must be ${MIN_MINUTES}–${MAX_MINUTES} minutes.`);
  return {
    id, title, config: cfg, qids,
    drafts: Object.fromEntries(qids.map((qid) => [qid, emptyDraft(q(qid))])),
    review: [], visited: [qids[0]], ms: Object.fromEntries(qids.map((qid) => [qid, 0])),
    current: 0, startedAt: now, deadline: now + cfg.minutes * 60_000, enteredAt: now,
  };
}

/** Milliseconds left, never negative. */
export const remainingMs = (e: ActiveExam, now: number) => Math.max(0, e.deadline - now);
export const isExpired = (e: ActiveExam, now: number) => now >= e.deadline;

/** Credits the time since the current question was shown (never past the deadline) to that question. */
function clock(e: ActiveExam, now: number): ActiveExam {
  const until = Math.min(now, e.deadline);
  const spent = Math.max(0, until - e.enteredAt);
  const qid = e.qids[e.current];
  return { ...e, enteredAt: Math.max(e.enteredAt, until), ms: { ...e.ms, [qid]: e.ms[qid] + spent } };
}

/** After a reload or a return to the exam page: time away from the page is not credited to any question. */
export const resumeExam = (e: ActiveExam, now: number): ActiveExam => ({ ...e, enteredAt: Math.min(Math.max(now, e.enteredAt), e.deadline) });

export function goTo(e: ActiveExam, index: number, now: number): ActiveExam {
  if (index < 0 || index >= e.qids.length || index === e.current || isExpired(e, now)) return e;
  const t = clock(e, now);
  const qid = e.qids[index];
  return { ...t, current: index, visited: t.visited.includes(qid) ? t.visited : [...t.visited, qid] };
}

export function setAnswer(e: ActiveExam, qid: string, d: Draft, now: number): ActiveExam {
  if (isExpired(e, now) || !(qid in e.drafts)) return e;
  return { ...e, drafts: { ...e.drafts, [qid]: d } };
}

export function toggleReview(e: ActiveExam, qid: string): ActiveExam {
  return { ...e, review: e.review.includes(qid) ? e.review.filter((x) => x !== qid) : [...e.review, qid] };
}

export type QuestionState = "answered" | "unanswered" | "not-visited";
export function questionState(e: ActiveExam, q: Question): QuestionState {
  if (isAnswered(q, e.drafts[q.id])) return "answered";
  return e.visited.includes(q.id) ? "unanswered" : "not-visited";
}

export function examCounts(e: ActiveExam, q: Lookup) {
  const states = e.qids.map((id) => questionState(e, q(id)));
  return {
    answered: states.filter((s) => s === "answered").length,
    unanswered: states.filter((s) => s !== "answered").length,
    review: e.review.length,
  };
}

/**
 * Ends the exam and produces its record plus the attempts to log. Auto-marked answers are graded now.
 * Written answers are kept with `awaitingMark` until the learner marks them (markExamItem).
 * Unanswered questions score 0 in the record but are not logged as attempts.
 * If the deadline has passed, the exam counts as submitted by timeout at the deadline.
 */
export function submitExam(e: ActiveExam, q: Lookup, now: number, by: "submitted" | "timeout" = "submitted"): { record: ExamRecord; attempts: Attempt[] } {
  const endedBy = by === "timeout" || isExpired(e, now) ? "timeout" : "submitted";
  const end = endedBy === "timeout" ? e.deadline : Math.min(now, e.deadline);
  const t = clock(e, end);
  const attempts: Attempt[] = [];
  const items: ExamItem[] = t.qids.map((qid) => {
    const question = q(qid);
    const draft = t.drafts[qid];
    const answered = isAnswered(question, draft);
    const self = isSelfMarked(question);
    const ms = Math.round(t.ms[qid]);
    const base = { qid, unit: question.unit, section: question.section, concepts: question.concepts, difficulty: question.difficulty, max: question.marks, answered, markedForReview: t.review.includes(qid), selfMarked: self, ms, draft };
    if (!answered) return { ...base, score: 0 };
    if (self) return { ...base, score: 0, awaitingMark: true };
    const g = gradeDraft(question, draft);
    attempts.push({ qid, unit: question.unit, concepts: question.concepts, score: g.score, max: g.max, at: end, sessionId: t.id, mode: "exam", ms });
    return { ...base, score: g.score };
  });
  const record: ExamRecord = {
    id: t.id, title: t.title, startedAt: t.startedAt, submittedAt: end, limitMs: t.deadline - t.startedAt, elapsedMs: end - t.startedAt, endedBy,
    config: { units: t.config.units, difficulties: t.config.difficulties, count: t.qids.length }, items,
  };
  return { record, attempts };
}

/** The learner marks a written answer after the exam; returns the updated record and the attempt to log. */
export function markExamItem(r: ExamRecord, question: Question, draft: Draft, now: number): { record: ExamRecord; attempt: Attempt | null } {
  const i = r.items.findIndex((x) => x.qid === question.id);
  const it = r.items[i];
  if (!it || !it.awaitingMark) return { record: r, attempt: null };
  const g = gradeDraft(question, draft);
  const items = r.items.map((x, j) => (j === i ? { ...x, score: g.score, awaitingMark: false, draft } : x));
  return {
    record: { ...r, items },
    attempt: { qid: it.qid, unit: it.unit, concepts: it.concepts, score: g.score, max: g.max, at: now, sessionId: r.id, mode: "exam", ms: it.ms, selfMarked: true },
  };
}

// ---------- Results (computed from the record only) ----------

export interface Breakdown {
  key: string;
  questions: number;
  correct: number;
  score: number;
  max: number;
}

export interface ExamResults {
  score: number;
  max: number; // all marks in the exam, unanswered included
  percent: number; // score / max
  answered: number;
  accuracy: number | null; // score / marks of answered and marked questions
  correct: number;
  incorrect: string[]; // answered and marked, below full marks
  unattempted: string[];
  awaitingMark: string[];
  reviewFlagged: string[];
  elapsedMs: number;
  limitMs: number;
  endedBy: ExamRecord["endedBy"];
  byUnit: Breakdown[];
  byConcept: Breakdown[];
  byDifficulty: Breakdown[];
}

function breakdown(items: ExamItem[], keys: (it: ExamItem) => string[], order?: (a: string, b: string) => number): Breakdown[] {
  const m = new Map<string, Breakdown>();
  for (const it of items)
    for (const key of keys(it)) {
      const b = m.get(key) ?? { key, questions: 0, correct: 0, score: 0, max: 0 };
      m.set(key, { key, questions: b.questions + 1, correct: b.correct + (it.answered && !it.awaitingMark && it.score >= it.max ? 1 : 0), score: b.score + it.score, max: b.max + it.max });
    }
  return [...m.values()].sort((a, b) => (order ? order(a.key, b.key) : a.key.localeCompare(b.key)));
}

const r2 = (x: number) => Math.round(x * 100) / 100;

export function examResults(r: ExamRecord): ExamResults {
  const items = r.items;
  const marked = items.filter((x) => x.answered && !x.awaitingMark);
  const score = r2(items.reduce((s, x) => s + x.score, 0));
  const max = items.reduce((s, x) => s + x.max, 0);
  const markedMax = marked.reduce((s, x) => s + x.max, 0);
  return {
    score, max, percent: max ? score / max : 0,
    answered: items.filter((x) => x.answered).length,
    accuracy: markedMax ? marked.reduce((s, x) => s + x.score, 0) / markedMax : null,
    correct: marked.filter((x) => x.score >= x.max).length,
    incorrect: marked.filter((x) => x.score < x.max).map((x) => x.qid),
    unattempted: items.filter((x) => !x.answered).map((x) => x.qid),
    awaitingMark: items.filter((x) => x.awaitingMark).map((x) => x.qid),
    reviewFlagged: items.filter((x) => x.markedForReview).map((x) => x.qid),
    elapsedMs: r.elapsedMs, limitMs: r.limitMs, endedBy: r.endedBy,
    byUnit: breakdown(items, (x) => [x.unit]),
    byConcept: breakdown(items, (x) => x.concepts),
    byDifficulty: breakdown(items, (x) => [String(x.difficulty)], (a, b) => Number(a) - Number(b)),
  };
}

/** Checks a stored active exam before resuming it. Anything malformed is discarded. */
export function isActiveExam(v: unknown): v is ActiveExam {
  const e = v as ActiveExam;
  return (
    !!e && typeof e === "object" && typeof e.id === "string" && typeof e.title === "string" && Array.isArray(e.qids) && e.qids.length > 0 &&
    e.qids.every((id) => typeof id === "string" && e.drafts?.[id] && typeof e.ms?.[id] === "number") && Array.isArray(e.review) && Array.isArray(e.visited) &&
    Number.isInteger(e.current) && e.current >= 0 && e.current < e.qids.length &&
    typeof e.startedAt === "number" && typeof e.deadline === "number" && e.deadline > e.startedAt && typeof e.enteredAt === "number" && typeof e.config === "object"
  );
}

export { formatClock } from "./clock";
