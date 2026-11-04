// Versioned localStorage persistence (pattern from the Cloud Computing Mastery Lab).
// Corrupt data is kept under a backup key, never silently discarded, and the app starts fresh.
import {
  CONCEPT_STATUSES,
  emptyProgress,
  type Activity,
  type Attempt,
  type CardState,
  type ConceptStatus,
  type ProgressData,
} from "../domain/progress";

export const APP_ID = "rl-study-lab";
export const STORAGE_KEY = "rlsl:v1";
export const SCHEMA_VERSION = 1;

interface Envelope {
  schema: number;
  savedAt: number;
  data: ProgressData;
}

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === "string" && v.length > 0;

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
  const attempts = arr(d.attempts).filter((a): a is Attempt => {
    const r = obj(a);
    return str(r.qid) && str(r.unit) && Array.isArray(r.concepts) && num(r.score) && num(r.max) && r.max > 0 && r.score >= 0 && r.score <= r.max && num(r.at);
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
    cards,
    activity,
    lastVisited: str(lv.path) && str(lv.title) && num(lv.at) ? { path: lv.path, title: lv.title, at: lv.at } : null,
    settings: {
      theme: ["system", "light", "dark"].includes(s.theme as string) ? (s.theme as ProgressData["settings"]["theme"]) : base.settings.theme,
      show2018Notation: s.show2018Notation === true,
    },
  };
}

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

export function loadProgress(key: string = STORAGE_KEY, now = Date.now()): LoadResult {
  const ls = storage();
  if (!ls) return { data: emptyProgress(), status: "fresh", message: "Browser storage is unavailable; progress will not be saved." };
  const text = ls.getItem(key);
  if (!text) return { data: emptyProgress(), status: "fresh" };
  try {
    const env = JSON.parse(text) as Partial<Envelope>;
    if (typeof env !== "object" || env === null || !("data" in env)) throw new Error("not a saved profile");
    if ((env.schema ?? 0) > SCHEMA_VERSION) throw new Error(`saved by a newer version of the app (schema ${env.schema})`);
    return { data: migrate(env.data), status: "loaded" };
  } catch (e) {
    const backupKey = `rlsl:backup:${now}`;
    try {
      ls.setItem(backupKey, text);
    } catch {
      /* storage full: the unreadable copy cannot be kept */
    }
    return {
      data: emptyProgress(),
      status: "recovered",
      message: `Saved progress could not be read (${(e as Error).message}). A copy was kept under "${backupKey}" and a fresh profile was started.`,
    };
  }
}

export function saveProgress(data: ProgressData, key: string = STORAGE_KEY, now = Date.now()): boolean {
  const ls = storage();
  if (!ls) return false;
  try {
    const env: Envelope = { schema: SCHEMA_VERSION, savedAt: now, data };
    ls.setItem(key, JSON.stringify(env));
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
    cards,
    activity: [...acts.values()].sort((a, b) => b.at - a.at).slice(0, 200),
    lastVisited,
    settings: cur.settings,
  };
}
