// Versioned localStorage persistence (pattern from the Cloud Computing Mastery Lab).
// Corrupt data is kept under a backup key, never silently discarded, and the app starts fresh.
import {
  CONCEPT_STATUSES,
  emptyProgress,
  type Activity,
  type Attempt,
  type CardState,
  ATTEMPT_MODES,
  type ConceptStatus,
  type ExamItem,
  type ExamRecord,
  type ProgressData,
} from "../domain/progress";

export const APP_ID = "rl-study-lab";
export const STORAGE_KEY = "rlsl:v1";
// 1: Milestone 2. 2: Milestone 3 adds bookmarks, exam records and attempt mode/time (older saves load with empty values).
export const SCHEMA_VERSION = 2;

interface Envelope {
  schema: number;
  savedAt: number;
  data: ProgressData;
}

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const bool = (v: unknown): v is boolean => typeof v === "boolean";

function examItem(v: unknown): ExamItem | null {
  const r = obj(v);
  if (!(str(r.qid) && str(r.unit) && (r.section === null || str(r.section)) && Array.isArray(r.concepts) && r.concepts.every(str))) return null;
  if (!(num(r.difficulty) && num(r.max) && r.max > 0 && num(r.score) && r.score >= 0 && r.score <= r.max && num(r.ms) && r.ms >= 0)) return null;
  if (!(bool(r.answered) && bool(r.markedForReview) && bool(r.selfMarked))) return null;
  const item: ExamItem = { qid: r.qid, unit: r.unit, section: r.section as string | null, concepts: r.concepts as string[], difficulty: r.difficulty, max: r.max, score: r.score, answered: r.answered, markedForReview: r.markedForReview, selfMarked: r.selfMarked, ms: r.ms };
  if (r.awaitingMark === true) item.awaitingMark = true;
  if (r.awaitingMark !== undefined && !bool(r.awaitingMark)) return null;
  if (r.draft !== undefined) {
    if (!r.draft || typeof r.draft !== "object" || Array.isArray(r.draft)) return null;
    item.draft = r.draft;
  }
  return item;
}

/** A whole exam record, or null if any part is malformed (a partial record would give wrong results). */
export function examRecord(v: unknown): ExamRecord | null {
  const r = obj(v);
  const c = obj(r.config);
  const items = arr(r.items).map(examItem);
  if (!(str(r.id) && str(r.title) && num(r.startedAt) && num(r.submittedAt) && r.submittedAt >= r.startedAt && num(r.limitMs) && r.limitMs > 0 && num(r.elapsedMs) && r.elapsedMs >= 0)) return null;
  if (!(r.endedBy === "submitted" || r.endedBy === "timeout")) return null;
  if (!(Array.isArray(c.units) && c.units.every(str) && Array.isArray(c.difficulties) && c.difficulties.every(num) && num(c.count))) return null;
  if (items.length === 0 || items.some((x) => x === null)) return null;
  return {
    id: r.id, title: r.title, startedAt: r.startedAt, submittedAt: r.submittedAt, limitMs: r.limitMs, elapsedMs: r.elapsedMs, endedBy: r.endedBy,
    config: { units: c.units as string[], difficulties: c.difficulties as number[], count: c.count }, items: items as ExamItem[],
  };
}

/** Keeps every well-formed record and drops malformed ones, so older or partial saves still load. */
export function migrate(raw: unknown): ProgressData {
  const base = emptyProgress();
  const d = obj(raw);
  const conceptStatus: ProgressData["conceptStatus"] = {};
  for (const [id, v] of Object.entries(obj(d.conceptStatus))) {
    const r = obj(v);
    if ((CONCEPT_STATUSES as readonly string[]).includes(r.status as string) && r.status !== "not-started" && num(r.at))
      conceptStatus[id] = { status: r.status as ConceptStatus, at: r.at };
  }
  const attempts = arr(d.attempts).flatMap((a): Attempt[] => {
    const r = obj(a);
    if (!(str(r.qid) && str(r.unit) && Array.isArray(r.concepts) && num(r.score) && num(r.max) && r.max > 0 && r.score >= 0 && r.score <= r.max && num(r.at))) return [];
    const out: Attempt = { qid: r.qid, unit: r.unit, concepts: r.concepts as string[], score: r.score, max: r.max, at: r.at };
    if (str(r.sessionId)) out.sessionId = r.sessionId;
    if ((ATTEMPT_MODES as readonly string[]).includes(r.mode as string)) out.mode = r.mode as Attempt["mode"];
    if (num(r.ms) && r.ms >= 0) out.ms = r.ms;
    if (bool(r.selfMarked)) out.selfMarked = r.selfMarked;
    return [out];
  });
  const cards: Record<string, CardState> = {};
  for (const [id, v] of Object.entries(obj(d.cards))) {
    const r = obj(v);
    if (num(r.reps) && num(r.interval) && num(r.ease) && num(r.due) && num(r.lapses))
      cards[id] = { reps: r.reps, interval: r.interval, ease: r.ease, due: r.due, lapses: r.lapses, last: num(r.last) ? r.last : null };
  }
  const activity = arr(d.activity).filter((a): a is Activity => str(obj(a).ref) && num(obj(a).at) && str(obj(a).kind));
  const lv = obj(d.lastVisited);
  const s = obj(d.settings);
  return {
    conceptStatus,
    attempts,
    marked: [...new Set(arr(d.marked).filter(str))].sort(),
    bookmarks: [...new Set(arr(d.bookmarks).filter(str))].sort(),
    cards,
    activity,
    lastVisited: str(lv.path) && str(lv.title) && num(lv.at) ? { path: lv.path, title: lv.title, at: lv.at } : null,
    settings: {
      theme: ["system", "light", "dark"].includes(s.theme as string) ? (s.theme as ProgressData["settings"]["theme"]) : base.settings.theme,
      show2018Notation: s.show2018Notation === true,
    },
    exams: arr(d.exams).map(examRecord).filter((x): x is ExamRecord => x !== null).sort((a, b) => a.startedAt - b.startedAt),
    sectionsRead: Object.fromEntries(Object.entries(obj(d.sectionsRead)).filter(([k, v]) => SECTION_KEY.test(k) && num(v))) as Record<string, number>,
    sectionBookmarks: [...new Set(arr(d.sectionBookmarks).filter((k): k is string => str(k) && SECTION_KEY.test(k)))].sort(),
  };
}

/** "ch02/2.3" or "sup-zhao-06/6.1". */
const SECTION_KEY = /^(ch\d{2}|sup-[a-z0-9-]+)\/\d+(\.\d+)*$/;

function storage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export interface LoadResult {
  data: ProgressData;
  status: "fresh" | "loaded" | "recovered";
  message?: string;
}

/** Parses a saved envelope. Throws a readable Error for anything that is not a profile this version can read. */
export function decodeSaved(text: string): ProgressData {
  const env = JSON.parse(text) as Partial<Envelope>;
  if (typeof env !== "object" || env === null || !("data" in env)) throw new Error("not a saved profile");
  if ((env.schema ?? 0) > SCHEMA_VERSION) throw new Error(`saved by a newer version of the app (schema ${env.schema})`);
  return migrate(env.data);
}

export const encodeSaved = (data: ProgressData, now = Date.now()): string => JSON.stringify({ schema: SCHEMA_VERSION, savedAt: now, data } satisfies Envelope);

export const backupKeyFor = (now: number) => `rlsl:backup:${now}`;
export const recoveredMessage = (e: unknown, backupKey: string) =>
  `Saved progress could not be read (${(e as Error).message}). A copy was kept under "${backupKey}" and a fresh profile was started.`;

export function loadProgress(key: string = STORAGE_KEY, now = Date.now()): LoadResult {
  const ls = storage();
  if (!ls) return { data: emptyProgress(), status: "fresh", message: "Browser storage is unavailable; progress will not be saved." };
  const text = ls.getItem(key);
  if (!text) return { data: emptyProgress(), status: "fresh" };
  try {
    return { data: decodeSaved(text), status: "loaded" };
  } catch (e) {
    const backupKey = backupKeyFor(now);
    try {
      ls.setItem(backupKey, text);
    } catch {
      /* storage full: the unreadable copy cannot be kept */
    }
    return { data: emptyProgress(), status: "recovered", message: recoveredMessage(e, backupKey) };
  }
}

export function saveProgress(data: ProgressData, key: string = STORAGE_KEY, now = Date.now()): boolean {
  const ls = storage();
  if (!ls) return false;
  try {
    ls.setItem(key, encodeSaved(data, now));
    return true;
  } catch {
    return false;
  }
}

export function exportProgress(data: ProgressData, now = Date.now()): string {
  return JSON.stringify({ app: APP_ID, schema: SCHEMA_VERSION, exportedAt: new Date(now).toISOString(), data }, null, 2);
}

/** Parses an export file. Throws Error with a readable message. */
export function parseImport(text: string): ProgressData {
  let o: { app?: unknown; schema?: unknown; data?: unknown };
  try {
    o = JSON.parse(text);
  } catch {
    throw new Error("Not a JSON file.");
  }
  if (!o || o.app !== APP_ID || !o.data) throw new Error("This file is not an RL Study Lab export.");
  if (typeof o.schema === "number" && o.schema > SCHEMA_VERSION) throw new Error("This export comes from a newer version of the app.");
  return migrate(o.data);
}

/**
 * Merges an imported profile into the current one (e.g. laptop + phone): attempts are united without duplicates,
 * the newer concept status and card state win, marks are united, and the current device keeps its settings.
 */
export function mergeProgress(cur: ProgressData, inc: ProgressData): ProgressData {
  const key = (a: Attempt) => `${a.qid}@${a.at}`;
  const seen = new Set(cur.attempts.map(key));
  const attempts = [...cur.attempts, ...inc.attempts.filter((a) => !seen.has(key(a)))].sort((a, b) => a.at - b.at);
  const conceptStatus = { ...cur.conceptStatus };
  for (const [id, s] of Object.entries(inc.conceptStatus)) if (!conceptStatus[id] || s.at > conceptStatus[id].at) conceptStatus[id] = s;
  const cards = { ...cur.cards };
  for (const [id, c] of Object.entries(inc.cards)) {
    const mine = cards[id];
    if (!mine || (c.last ?? -1) > (mine.last ?? -1)) cards[id] = c; // the later review wins
  }
  const actKey = (a: Activity) => `${a.at}|${a.kind}|${a.ref}`;
  const acts = new Map([...cur.activity, ...inc.activity].map((a) => [actKey(a), a]));
  const lastVisited = [cur.lastVisited, inc.lastVisited].filter((v) => v).sort((a, b) => b!.at - a!.at)[0] ?? null;
  return {
    conceptStatus,
    attempts,
    marked: [...new Set([...cur.marked, ...inc.marked])].sort(),
    bookmarks: [...new Set([...cur.bookmarks, ...inc.bookmarks])].sort(),
    cards,
    activity: [...acts.values()].sort((a, b) => b.at - a.at).slice(0, 200),
    lastVisited,
    settings: cur.settings,
    exams: [...new Map([...inc.exams, ...cur.exams].map((e) => [e.id, e])).values()].sort((a, b) => a.startedAt - b.startedAt),
    // Read marks are united (the later time wins); section bookmarks are united.
    sectionsRead: Object.fromEntries([...new Set([...Object.keys(cur.sectionsRead), ...Object.keys(inc.sectionsRead)])].map((k) => [k, Math.max(cur.sectionsRead[k] ?? 0, inc.sectionsRead[k] ?? 0)])),
    sectionBookmarks: [...new Set([...cur.sectionBookmarks, ...inc.sectionBookmarks])].sort(),
  };
}
