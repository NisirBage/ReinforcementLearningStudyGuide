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
