// A practice session as pure data plus transition functions (no React, no clock: `now` is passed in).
// The UI keeps one of these in state and saves it to IndexedDB after every change, so a refresh resumes it.
//
// Item phases:
//   answering  the learner is working on it
//   revealed   self-marked question: the model answer and rubric are shown; waiting for the learner's mark
//   graded     scored and recorded as an attempt
// Feedback "immediate" grades a question when the learner checks it; "deferred" grades everything at the end
// and shows no answer before then.
import type { Question } from "../content/schema";
import type { Attempt } from "./progress";
import type { Grade } from "./grade";
import type { PracticeConfig } from "./practice";
import { emptyDraft, gradeDraft, isAnswered, isSelfMarked, type Draft } from "./answer";

export type Phase = "answering" | "revealed" | "graded";

export interface ItemState {
  qid: string;
  draft: Draft;
  phase: Phase;
  grade: Grade | null;
  steps: number; // solution steps revealed so far (step-by-step viewing)
  ms: number; // time this question has been on screen
}

export interface PracticeSession {
  id: string;
  config: PracticeConfig;
  qids: string[];
  items: Record<string, ItemState>;
  current: number;
  startedAt: number;
  enteredAt: number; // when the current question was shown
  finishedAt: number | null;
}

type Lookup = (qid: string) => Question;

export function startSession(id: string, config: PracticeConfig, qids: string[], q: Lookup, now: number): PracticeSession {
  if (qids.length === 0) throw new Error("A practice session needs at least one question.");
  const items = Object.fromEntries(qids.map((qid) => [qid, { qid, draft: emptyDraft(q(qid)), phase: "answering" as Phase, grade: null, steps: 0, ms: 0 }]));
  return { id, config, qids, items, current: 0, startedAt: now, enteredAt: now, finishedAt: null };
}

const currentQid = (s: PracticeSession) => s.qids[s.current];

/** Adds the time since the current question was shown to that question. */
function clock(s: PracticeSession, now: number): PracticeSession {
  const qid = currentQid(s);
  const spent = Math.max(0, now - s.enteredAt);
  return { ...s, enteredAt: now, items: { ...s.items, [qid]: { ...s.items[qid], ms: s.items[qid].ms + spent } } };
}

const patch = (s: PracticeSession, qid: string, p: Partial<ItemState>): PracticeSession => ({ ...s, items: { ...s.items, [qid]: { ...s.items[qid], ...p } } });

export function goTo(s: PracticeSession, index: number, now: number): PracticeSession {
  if (index < 0 || index >= s.qids.length || index === s.current) return s;
  return { ...clock(s, now), current: index };
}

export function setDraft(s: PracticeSession, qid: string, draft: Draft): PracticeSession {
  const it = s.items[qid];
  if (!it || it.phase !== "answering" || s.finishedAt !== null) return s;
  return patch(s, qid, { draft });
}

export function revealStep(s: PracticeSession, qid: string, q: Question, all = false): PracticeSession {
  const it = s.items[qid];
  return patch(s, qid, { steps: all ? q.solution.length : Math.min(q.solution.length, it.steps + 1) });
}

const attemptOf = (s: PracticeSession, q: Question, it: ItemState, grade: Grade, at: number): Attempt => ({
  qid: q.id, unit: q.unit, concepts: q.concepts, score: grade.score, max: grade.max, at, sessionId: s.id, mode: "practice", ms: Math.round(it.ms),
  ...(isSelfMarked(q) ? { selfMarked: true } : {}),
});

/**
 * Immediate feedback: grades an auto-marked question and returns the attempt to record. A self-marked question
 * moves to "revealed" instead; the learner then marks it with markSelf().
 */
export function check(s: PracticeSession, q: Question, now: number): { session: PracticeSession; attempt: Attempt | null } {
  let t = clock(s, now);
  const it = t.items[q.id];
  if (it.phase !== "answering") return { session: t, attempt: null };
  if (isSelfMarked(q)) return { session: patch(t, q.id, { phase: "revealed" }), attempt: null };
  const grade = gradeDraft(q, it.draft);
  t = patch(t, q.id, { phase: "graded", grade });
  return { session: t, attempt: attemptOf(t, q, t.items[q.id], grade, now) };
}

/** Records the learner's own mark for a revealed self-marked question (rubric ticks or a single mark in the draft). */
export function markSelf(s: PracticeSession, q: Question, draft: Draft, now: number): { session: PracticeSession; attempt: Attempt | null } {
  const it = s.items[q.id];
  if (!it || it.phase !== "revealed") return { session: s, attempt: null };
  const grade = gradeDraft(q, draft);
  const t = patch(s, q.id, { phase: "graded", grade, draft });
  return { session: t, attempt: attemptOf(t, q, t.items[q.id], grade, now) };
}

/**
 * Ends the session. Answered auto-marked questions still open are graded and returned as attempts; answered
 * self-marked ones are revealed for the learner to mark; unanswered questions stay unattempted (no attempt).
 */
export function finish(s: PracticeSession, q: Lookup, now: number): { session: PracticeSession; attempts: Attempt[] } {
  let t = clock(s, now);
  const attempts: Attempt[] = [];
  for (const qid of t.qids) {
    const it = t.items[qid];
    const question = q(qid);
    if (it.phase !== "answering" || !isAnswered(question, it.draft)) continue;
    if (isSelfMarked(question)) {
      t = patch(t, qid, { phase: "revealed" });
      continue;
    }
    const grade = gradeDraft(question, it.draft);
    t = patch(t, qid, { phase: "graded", grade });
    attempts.push(attemptOf(t, question, t.items[qid], grade, now));
  }
  return { session: { ...t, finishedAt: now }, attempts };
}

export interface SessionSummary {
  questions: number;
  graded: number;
  correct: number; // full marks
  partial: number;
  incorrect: number; // graded with zero marks
  unanswered: number;
  awaitingMark: number; // self-marked, revealed, not yet marked
  score: number;
  max: number; // marks available on graded questions
  accuracy: number | null; // score / max over graded questions
  ms: number;
  wrongQids: string[]; // graded below full marks
}

export function summarize(s: PracticeSession, q: Lookup): SessionSummary {
  const items = s.qids.map((id) => s.items[id]);
  const graded = items.filter((i) => i.phase === "graded" && i.grade);
  const score = graded.reduce((t, i) => t + i.grade!.score, 0);
  const max = graded.reduce((t, i) => t + i.grade!.max, 0);
  return {
    questions: items.length,
    graded: graded.length,
    correct: graded.filter((i) => i.grade!.correct).length,
    partial: graded.filter((i) => !i.grade!.correct && i.grade!.score > 0).length,
    incorrect: graded.filter((i) => i.grade!.score === 0).length,
    unanswered: items.filter((i) => i.phase === "answering" && !isAnswered(q(i.qid), i.draft)).length,
    awaitingMark: items.filter((i) => i.phase === "revealed").length,
    score: Math.round(score * 100) / 100,
    max,
    accuracy: max ? score / max : null,
    ms: items.reduce((t, i) => t + i.ms, 0),
    wrongQids: graded.filter((i) => !i.grade!.correct).map((i) => i.qid),
  };
}

/** Checks a value read back from storage before trusting it as a session (anything malformed is discarded). */
export function isSession(v: unknown): v is PracticeSession {
  const s = v as PracticeSession;
  return (
    !!s && typeof s === "object" && typeof s.id === "string" && Array.isArray(s.qids) && s.qids.length > 0 && s.qids.every((x) => typeof x === "string") &&
    typeof s.items === "object" && s.qids.every((id) => s.items[id] && typeof s.items[id].draft === "object") &&
    Number.isInteger(s.current) && s.current >= 0 && s.current < s.qids.length && typeof s.startedAt === "number" && typeof s.config === "object"
  );
}
