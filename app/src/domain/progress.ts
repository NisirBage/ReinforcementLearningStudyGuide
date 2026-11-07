// Learner progress: pure data functions (no browser APIs), so they are unit-tested directly.
// Nothing here invents data: a fresh profile is empty and every number on the dashboard derives from it.

export const CONCEPT_STATUSES = ["not-started", "learning", "understood", "needs-revision", "mastered"] as const;
export type ConceptStatus = (typeof CONCEPT_STATUSES)[number];
export const STATUS_LABEL: Record<ConceptStatus, string> = {
  "not-started": "Not started",
  learning: "Learning",
  understood: "Understood",
  "needs-revision": "Needs revision",
  mastered: "Mastered",
};

export type Theme = "system" | "light" | "dark";

export interface Settings {
  theme: Theme;
  show2018Notation: boolean; // show cross-references to the published 2018 edition next to the original 2015 notation
}

export interface Attempt {
  qid: string;
  unit: string;
  concepts: string[];
  score: number; // marks awarded
  max: number; // marks available
  at: number; // epoch ms
  sessionId?: string; // practice session or exam id
  mode?: AttemptMode; // where the attempt was made (absent in v1 saves: those were all lesson exercises)
  ms?: number; // time spent on the question, when measured
  selfMarked?: boolean; // derivation / short-answer: the score is the learner's own mark against the rubric
}

export const ATTEMPT_MODES = ["lesson", "practice", "exam", "review"] as const;
export type AttemptMode = (typeof ATTEMPT_MODES)[number];

/** One question as it stood when an exam was submitted. Results pages compute everything from these. */
export interface ExamItem {
  qid: string;
  unit: string;
  section: string | null;
  concepts: string[];
  difficulty: number;
  max: number;
  score: number; // 0 when unanswered
  answered: boolean;
  markedForReview: boolean;
  selfMarked: boolean;
  ms: number; // time the question was on screen
  awaitingMark?: boolean; // written answer not yet self-marked (score 0 until then)
  draft?: unknown; // the learner's answer as entered, for the review (domain/answer.ts Draft)
}

/** A submitted mock exam. Stored as data, so results are recomputed, never hard-coded. */
export interface ExamRecord {
  id: string;
  title: string;
  startedAt: number;
  submittedAt: number;
  limitMs: number; // configured duration
  elapsedMs: number; // time actually used (≤ limitMs)
  endedBy: "submitted" | "timeout";
  config: { units: string[]; difficulties: number[]; count: number };
  items: ExamItem[];
}

/** Spaced-repetition state of one revision card (SM-2 family). */
export interface CardState {
  reps: number; // successful reviews in a row
  interval: number; // days until the next review
  ease: number; // ≥ 1.3
  due: number; // epoch ms
  lapses: number;
  last: number | null; // epoch ms of the last review, null before the first
}

export type ActivityKind = "lesson" | "status" | "attempt" | "test" | "review" | "lab";
export interface Activity {
  at: number;
  kind: ActivityKind;
  ref: string; // unit, concept, question, test or lab id
  detail?: string;
}

export interface ProgressData {
  conceptStatus: Record<string, { status: ConceptStatus; at: number }>;
  attempts: Attempt[];
  marked: string[]; // question ids flagged for revision, sorted
  bookmarks: string[]; // question ids bookmarked, sorted (separate from the revision flag)
  cards: Record<string, CardState>;
  activity: Activity[]; // newest first, capped
  lastVisited: { path: string; title: string; at: number } | null;
  settings: Settings;
  exams: ExamRecord[]; // submitted mock exams, oldest first
  /** Sections the learner has marked as read, "<unit>/<section>" → when (Milestone 4A; absent in older saves). */
  sectionsRead: Record<string, number>;
  /** Bookmarked sections, "<unit>/<section>", sorted (separate from question bookmarks). */
  sectionBookmarks: string[];
}

export const ACTIVITY_CAP = 200;
export const DAY = 86_400_000;

export const emptyProgress = (): ProgressData => ({
  conceptStatus: {},
  attempts: [],
  marked: [],
  bookmarks: [],
  cards: {},
  activity: [],
  lastVisited: null,
  settings: { theme: "system", show2018Notation: false },
  exams: [],
  sectionsRead: {},
  sectionBookmarks: [],
});

export function logActivity(p: ProgressData, a: Activity): ProgressData {
  return { ...p, activity: [a, ...p.activity].slice(0, ACTIVITY_CAP) };
}

export function setConceptStatus(p: ProgressData, concept: string, status: ConceptStatus, now: number): ProgressData {
  const conceptStatus = { ...p.conceptStatus };
  if (status === "not-started") delete conceptStatus[concept];
  else conceptStatus[concept] = { status, at: now };
  return logActivity({ ...p, conceptStatus }, { at: now, kind: "status", ref: concept, detail: status });
}

export const statusOf = (p: ProgressData, concept: string): ConceptStatus => p.conceptStatus[concept]?.status ?? "not-started";

export function recordAttempt(p: ProgressData, a: Attempt): ProgressData {
  if (!(a.max > 0) || a.score < 0 || a.score > a.max) throw new Error(`invalid score ${a.score}/${a.max} for ${a.qid}`);
  return logActivity({ ...p, attempts: [...p.attempts, a] }, { at: a.at, kind: "attempt", ref: a.qid, detail: `${a.score}/${a.max}` });
}

export function toggleMarked(p: ProgressData, qid: string): ProgressData {
  const set = new Set(p.marked);
  if (set.has(qid)) set.delete(qid);
  else set.add(qid);
  return { ...p, marked: [...set].sort() };
}

export function toggleBookmark(p: ProgressData, qid: string): ProgressData {
  const set = new Set(p.bookmarks);
  if (set.has(qid)) set.delete(qid);
  else set.add(qid);
  return { ...p, bookmarks: [...set].sort() };
}

export function visit(p: ProgressData, path: string, title: string, now: number): ProgressData {
  return { ...p, lastVisited: { path, title, at: now } };
}

// ---------- Spaced repetition ----------

export const newCard = (now: number): CardState => ({ reps: 0, interval: 0, ease: 2.5, due: now, lapses: 0, last: null });

/**
 * SM-2 update. grade: 0 = forgot, 1 = hard, 2 = good, 3 = easy.
 * A lapse (grade 0) resets the streak and brings the card back tomorrow; ease never falls below 1.3.
 */
export function reviewCard(c: CardState, grade: 0 | 1 | 2 | 3, now: number): CardState {
  const q = [1, 3, 4, 5][grade]; // map onto SM-2's 0–5 quality scale
  const ease = Math.max(1.3, c.ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (grade === 0) return { reps: 0, interval: 1, ease, due: now + DAY, lapses: c.lapses + 1, last: now };
  const reps = c.reps + 1;
  let interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(c.interval * ease);
  if (grade === 1) interval = Math.max(1, Math.round(interval * 0.6));
  if (grade === 3) interval = Math.round(interval * 1.3);
  return { reps, interval, ease, due: now + interval * DAY, lapses: c.lapses, last: now };
}

export function review(p: ProgressData, cardId: string, grade: 0 | 1 | 2 | 3, now: number): ProgressData {
  const card = reviewCard(p.cards[cardId] ?? newCard(now), grade, now);
  return logActivity({ ...p, cards: { ...p.cards, [cardId]: card } }, { at: now, kind: "review", ref: cardId, detail: String(grade) });
}

/** Ids of cards due by `now`, most overdue first. Cards never reviewed are not "due"; they are new. */
export const dueCards = (p: ProgressData, now: number): string[] =>
  Object.entries(p.cards)
    .filter(([, c]) => c.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);

// ---------- Analytics ----------

export interface Accuracy {
  attempted: number; // distinct questions
  attempts: number;
  score: number;
  max: number;
  accuracy: number | null; // score / max over all attempts
}

export function accuracyOf(attempts: Attempt[]): Accuracy {
  const score = attempts.reduce((s, a) => s + a.score, 0);
  const max = attempts.reduce((s, a) => s + a.max, 0);
  return { attempted: new Set(attempts.map((a) => a.qid)).size, attempts: attempts.length, score, max, accuracy: max ? score / max : null };
}

/** Accuracy per key (unit or concept), weakest first; keys with fewer than minAttempts attempts are left out. */
export function weakest(attempts: Attempt[], by: "unit" | "concept", minAttempts = 3): { key: string; acc: Accuracy }[] {
  const groups = new Map<string, Attempt[]>();
  for (const a of attempts)
    for (const key of by === "unit" ? [a.unit] : a.concepts) groups.set(key, [...(groups.get(key) ?? []), a]);
  return [...groups.entries()]
    .map(([key, list]) => ({ key, acc: accuracyOf(list) }))
    .filter((g) => g.acc.attempts >= minAttempts)
    .sort((a, b) => (a.acc.accuracy ?? 0) - (b.acc.accuracy ?? 0) || a.key.localeCompare(b.key));
}

/** Share of the given concepts at "understood" or better. */
export function completion(p: ProgressData, concepts: string[]): number {
  if (!concepts.length) return 0;
  const done = concepts.filter((c) => ["understood", "mastered"].includes(statusOf(p, c))).length;
  return done / concepts.length;
}

/**
 * Today's review queue: cards due by `now` (most overdue first), then up to `newLimit` cards never reviewed,
 * in the order given. Cards reviewed but not yet due are left out.
 */
export function reviewQueue(p: ProgressData, cardIds: string[], now: number, newLimit = 10): { id: string; isNew: boolean }[] {
  const due = dueCards(p, now).filter((id) => cardIds.includes(id));
  const fresh = cardIds.filter((id) => !p.cards[id]).slice(0, newLimit);
  return [...due.map((id) => ({ id, isNew: false })), ...fresh.map((id) => ({ id, isNew: true }))];
}

// ---------- Per-question history (Milestone 3B) ----------

export interface QuestionStats {
  attempts: number;
  correct: number; // attempts with full marks
  wrong: number; // attempts below full marks
  last: Attempt; // most recent attempt
  ms: number; // measured time over all attempts
}

/** History of every attempted question, from the attempt log (nothing is stored twice). */
export function questionStats(attempts: Attempt[]): Map<string, QuestionStats> {
  const m = new Map<string, QuestionStats>();
  for (const a of [...attempts].sort((x, y) => x.at - y.at)) {
    const s = m.get(a.qid) ?? { attempts: 0, correct: 0, wrong: 0, last: a, ms: 0 };
    const full = a.score >= a.max;
    m.set(a.qid, { attempts: s.attempts + 1, correct: s.correct + (full ? 1 : 0), wrong: s.wrong + (full ? 0 : 1), last: a, ms: s.ms + (a.ms ?? 0) });
  }
  return m;
}

/** Questions whose most recent attempt fell short of full marks: the "re-attempt incorrect" set. */
export const incorrectQids = (attempts: Attempt[]): string[] =>
  [...questionStats(attempts).entries()].filter(([, s]) => s.last.score < s.last.max).map(([id]) => id).sort();

/** Questions answered wrongly at least `min` times, most often first. */
export const repeatedMistakes = (attempts: Attempt[], min = 2): { qid: string; wrong: number; attempts: number }[] =>
  [...questionStats(attempts).entries()]
    .filter(([, s]) => s.wrong >= min)
    .map(([qid, s]) => ({ qid, wrong: s.wrong, attempts: s.attempts }))
    .sort((a, b) => b.wrong - a.wrong || a.qid.localeCompare(b.qid));

/** Measured time on questions (attempts made before timing existed count as 0). */
export const timeSpentMs = (attempts: Attempt[]): number => attempts.reduce((t, a) => t + (a.ms ?? 0), 0);

/** Records several attempts at once (end of a practice session), each validated like a single attempt. */
export const recordAttempts = (p: ProgressData, list: Attempt[]): ProgressData => list.reduce(recordAttempt, p);

// ---------- Mock exams (Milestone 3C) ----------

/** Stores a submitted exam (replacing an earlier version of the same exam, e.g. after self-marking). */
export function saveExamRecord(p: ProgressData, r: ExamRecord): ProgressData {
  const known = p.exams.some((e) => e.id === r.id);
  const exams = [...p.exams.filter((e) => e.id !== r.id), r].sort((a, b) => a.startedAt - b.startedAt);
  return known ? { ...p, exams } : logActivity({ ...p, exams }, { at: r.submittedAt, kind: "test", ref: r.id, detail: r.title });
}

// ---------- Progress summaries (Milestone 3F) ----------
// Everything below is computed from the stored attempts, exams, cards and statuses; nothing is stored twice.

export interface QuestionSummary {
  attempted: number; // distinct questions
  attempts: number;
  correct: number; // questions whose latest attempt earned full marks
  incorrect: number; // questions whose latest attempt fell short
  accuracy: number | null; // marks scored over marks available, all attempts
  ms: number; // measured time
}

export function questionSummary(attempts: Attempt[]): QuestionSummary {
  const latest = [...questionStats(attempts).values()].map((s) => s.last);
  return {
    attempted: latest.length,
    attempts: attempts.length,
    correct: latest.filter((a) => a.score >= a.max).length,
    incorrect: latest.filter((a) => a.score < a.max).length,
    accuracy: accuracyOf(attempts).accuracy,
    ms: timeSpentMs(attempts),
  };
}

export interface TopicMastery {
  concept: string;
  status: ConceptStatus; // set by the learner
  available: number; // questions in the app on this concept
  attempted: number; // of those, attempted at least once
  latest: number | null; // marks on the latest attempt of each attempted question, as a share
}

/** Per concept: the learner's own status beside the evidence from their answers. */
export function topicMastery(p: ProgressData, concepts: string[], questions: { id: string; concepts: string[] }[]): TopicMastery[] {
  const stats = questionStats(p.attempts);
  return concepts.map((concept) => {
    const qs = questions.filter((q) => q.concepts.includes(concept));
    const last = qs.map((q) => stats.get(q.id)?.last).filter((a): a is Attempt => !!a);
    const max = last.reduce((s, a) => s + a.max, 0);
    return { concept, status: statusOf(p, concept), available: qs.length, attempted: last.length, latest: max ? last.reduce((s, a) => s + a.score, 0) / max : null };
  });
}

export interface Backlog {
  dueCards: string[];
  flagged: string[]; // questions marked for revision
  incorrect: string[]; // latest attempt below full marks
  needsRevision: string[]; // concepts with that status
  total: number; // distinct items across the four lists
}

export function revisionBacklog(p: ProgressData, now: number): Backlog {
  const dueList = dueCards(p, now);
  const incorrect = incorrectQids(p.attempts);
  const needsRevision = Object.entries(p.conceptStatus).filter(([, s]) => s.status === "needs-revision").map(([c]) => c).sort();
  return { dueCards: dueList, flagged: p.marked, incorrect, needsRevision, total: new Set([...dueList, ...p.marked, ...incorrect, ...needsRevision]).size };
}

export interface ExamSummary {
  count: number;
  best: number | null; // best score share
  latest: { id: string; title: string; at: number; percent: number } | null;
  average: number | null;
}

export function examSummary(exams: ExamRecord[]): ExamSummary {
  const pcts = exams.map((e) => {
    const max = e.items.reduce((s, x) => s + x.max, 0);
    return max ? e.items.reduce((s, x) => s + x.score, 0) / max : 0;
  });
  const last = exams.length ? exams[exams.length - 1] : null;
  return {
    count: exams.length,
    best: pcts.length ? Math.max(...pcts) : null,
    latest: last ? { id: last.id, title: last.title, at: last.submittedAt, percent: pcts[pcts.length - 1] } : null,
    average: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null,
  };
}

/** Logs opening a lab, unless the newest activity already is that lab. */
export function openLab(p: ProgressData, slug: string, title: string, now: number): ProgressData {
  const top = p.activity[0];
  return top?.kind === "lab" && top.ref === slug ? p : logActivity(p, { at: now, kind: "lab", ref: slug, detail: title });
}

/** Labs opened, most recent first, from the activity log (which keeps the newest 200 entries). */
export function labUse(p: ProgressData): { slug: string; title: string; visits: number; last: number }[] {
  const m = new Map<string, { slug: string; title: string; visits: number; last: number }>();
  for (const a of p.activity)
    if (a.kind === "lab") {
      const e = m.get(a.ref);
      m.set(a.ref, e ? { ...e, visits: e.visits + 1 } : { slug: a.ref, title: a.detail ?? a.ref, visits: 1, last: a.at });
    }
  return [...m.values()].sort((a, b) => b.last - a.last);
}

// ---------- Reading progress and section bookmarks (Milestone 4A) ----------

/** The key of a section in sectionsRead and sectionBookmarks. */
export const sectionKey = (unit: string, section: string) => `${unit}/${section}`;

/** Marks a section as read, or clears the mark. Reading is the learner's own statement, never inferred from a visit. */
export function setSectionRead(p: ProgressData, key: string, read: boolean, now: number): ProgressData {
  const sectionsRead = { ...p.sectionsRead };
  if (read) sectionsRead[key] = now;
  else delete sectionsRead[key];
  return { ...p, sectionsRead };
}

export function toggleSectionBookmark(p: ProgressData, key: string): ProgressData {
  const set = new Set(p.sectionBookmarks);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  return { ...p, sectionBookmarks: [...set].sort() };
}

/** How many of the given section keys are marked read. */
export const readCount = (p: ProgressData, keys: string[]) => keys.filter((k) => p.sectionsRead[k] !== undefined).length;
