// Choosing practice questions. Pure: works on the catalogue's question stubs and the learner's progress,
// so the same filters always give the same set, and the same seed always gives the same order.
import type { QuestionStub } from "../content/catalog";
import type { ProvenanceKind, QuestionType } from "../content/schema";
import { isSupplementaryUnit } from "../content/schema";
import { incorrectQids, questionStats, type ProgressData } from "./progress";
import { makeRng, shuffle } from "./random";

/** Which questions to draw from, besides the filters. */
export const POOLS = ["all", "unattempted", "incorrect", "repeated", "bookmarked", "flagged"] as const;
export type Pool = (typeof POOLS)[number];
export const POOL_LABEL: Record<Pool, string> = {
  all: "All matching questions",
  unattempted: "Not attempted yet",
  incorrect: "Got wrong last time",
  repeated: "Repeated mistakes (wrong twice or more)",
  bookmarked: "Bookmarked",
  flagged: "Flagged for revision",
};

export const ORDERS = ["random", "interleaved", "book"] as const;
export type Order = (typeof ORDERS)[number];
export const ORDER_LABEL: Record<Order, string> = {
  random: "Random",
  interleaved: "Mixed topics (alternate chapters and sections)",
  book: "Book order",
};

export type FeedbackMode = "immediate" | "deferred";

export interface PracticeConfig {
  /** Units to draw from. Empty = every core chapter. Supplementary modules are included only when listed. */
  units: string[];
  sections: string[]; // empty = all sections
  concepts: string[]; // topics; empty = all
  difficulties: number[]; // empty = all
  types: QuestionType[]; // empty = all
  provenance: ProvenanceKind[]; // empty = all
  pool: Pool;
  count: number;
  order: Order;
  seed: number;
  feedback: FeedbackMode;
}

export const defaultConfig = (seed: number): PracticeConfig => ({
  units: [], sections: [], concepts: [], difficulties: [], types: [], provenance: [], pool: "all", count: 10, order: "random", seed, feedback: "immediate",
});

const has = <T,>(list: readonly T[], x: T) => list.length === 0 || list.includes(x);

/** Section ids compare numerically part by part ("2.10" after "2.9"); null (whole chapter) comes last. */
export function compareSections(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? -1) !== (pb[i] ?? -1)) return (pa[i] ?? -1) - (pb[i] ?? -1);
  return 0;
}

/** Book order: units in curriculum order, then sections, then question id. */
export function bookOrder(qs: QuestionStub[], unitOrder: string[]): QuestionStub[] {
  const rank = new Map(unitOrder.map((u, i) => [u, i]));
  return [...qs].sort((x, y) => (rank.get(x.unit) ?? 1e9) - (rank.get(y.unit) ?? 1e9) || compareSections(x.section, y.section) || x.id.localeCompare(y.id));
}

function inPool(q: QuestionStub, pool: Pool, p: ProgressData, stats: ReturnType<typeof questionStats>, wrong: Set<string>): boolean {
  switch (pool) {
    case "all":
      return true;
    case "unattempted":
      return !stats.has(q.id);
    case "incorrect":
      return wrong.has(q.id);
    case "repeated":
      return (stats.get(q.id)?.wrong ?? 0) >= 2;
    case "bookmarked":
      return p.bookmarks.includes(q.id);
    case "flagged":
      return p.marked.includes(q.id);
  }
}

/** Every question matching the filters and pool, in book order. */
export function matchingQuestions(all: QuestionStub[], cfg: PracticeConfig, p: ProgressData, unitOrder: string[]): QuestionStub[] {
  const stats = questionStats(p.attempts);
  const wrong = new Set(incorrectQids(p.attempts));
  const units = cfg.units;
  const out = all.filter(
    (q) =>
      (units.length ? units.includes(q.unit) : !isSupplementaryUnit(q.unit)) &&
      has(cfg.sections, q.section ?? "") &&
      (cfg.concepts.length === 0 || q.concepts.some((c) => cfg.concepts.includes(c))) &&
      has(cfg.difficulties, q.difficulty) &&
      has(cfg.types, q.type) &&
      has(cfg.provenance, q.provenance) &&
      inPool(q, cfg.pool, p, stats, wrong),
  );
  return bookOrder(out, unitOrder);
}

/**
 * Round-robin over topics (unit + section) after a seeded shuffle, so consecutive questions come from different
 * topics whenever more than one topic is left.
 */
export function interleave(qs: QuestionStub[], seed: number): QuestionStub[] {
  const rng = makeRng(seed);
  const groups = new Map<string, QuestionStub[]>();
  for (const q of shuffle(qs, rng)) {
    const k = `${q.unit}|${q.section ?? ""}`;
    groups.set(k, [...(groups.get(k) ?? []), q]);
  }
  const queues = shuffle([...groups.values()], rng);
  const out: QuestionStub[] = [];
  while (queues.some((g) => g.length)) for (const g of queues) if (g.length) out.push(g.shift()!);
  return out;
}

/** The question ids of a session: filtered, ordered by the chosen rule, and cut to `count`. */
export function selectQuestions(all: QuestionStub[], cfg: PracticeConfig, p: ProgressData, unitOrder: string[]): string[] {
  const pool = matchingQuestions(all, cfg, p, unitOrder);
  const ordered = cfg.order === "book" ? pool : cfg.order === "interleaved" ? interleave(pool, cfg.seed) : shuffle(pool, makeRng(cfg.seed));
  // Taking the first `count` of a shuffle samples without replacement; book order keeps the book's sequence.
  const picked = ordered.slice(0, Math.max(0, Math.floor(cfg.count)));
  return picked.map((q) => q.id);
}
