// Offline full-text search over every indexed item (sections, lectures, concepts, equations, questions…).
// No external service: an inverted index built in the browser, field-weighted scoring, prefix and
// one-typo matching for longer words, RL abbreviation expansion, and one hop of cross-references
// ("related") so a hit on "Bellman equation" also surfaces the concepts it links to.

export type DocType = "chapter" | "section" | "unit" | "concept" | "equation" | "algorithm" | "example" | "definition" | "notation";

export interface SearchDoc {
  id: string;
  type: DocType;
  title: string;
  body?: string; // summary or plain-text gloss
  keywords?: string[];
  ref: string; // human-readable location, e.g. "Zhao §7.4 · p. 140"
  href: string; // in-app route
  related?: string[]; // ids of other docs
  tier: "core" | "supplementary"; // supplementary results are always labelled as such
}

export interface SearchHit {
  doc: SearchDoc;
  score: number;
  via?: string; // id of the direct hit this result was reached from (cross-reference)
}

const STOP = new Set("a an and are as at be by for from in into is it of on or the to with what how why which".split(" "));

/** Abbreviations and alternative spellings, expanded both ways at query time. */
export const SYNONYMS: Record<string, string[]> = {
  boe: ["bellman", "optimality", "equation"],
  td: ["temporal", "difference"],
  mc: ["monte", "carlo"],
  dp: ["dynamic", "programming"],
  mdp: ["markov", "decision", "process"],
  sgd: ["stochastic", "gradient", "descent"],
  rm: ["robbins", "monro"],
  pg: ["policy", "gradient"],
  dqn: ["deep", "q", "learning"],
  a2c: ["advantage", "actor", "critic"],
  qac: ["actor", "critic"],
  dpg: ["deterministic", "policy", "gradient"],
  vi: ["value", "iteration"],
  pi: ["policy", "iteration"],
  gpi: ["generalized", "policy", "iteration"],
  ucb: ["upper", "confidence", "bound"],
  reinforce: ["monte", "carlo", "policy", "gradient"],
  eps: ["epsilon"],
  ε: ["epsilon"],
  γ: ["discount"],
  λ: ["lambda"],
  sarsa: ["sarsa"],
  qlearning: ["q", "learning"],
};

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/q-learning/g, "q learning")
    .split(/[^a-z0-9εγλ]+/)
    .filter((t) => t && !STOP.has(t))
    .map(stem);
}

/** Light suffix stripping so "values"/"value", "iterations"/"iteration", "learning"/"learn" meet. */
export function stem(t: string): string {
  if (t.length > 5 && t.endsWith("ing")) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}

/** True when a and b differ by at most one insertion, deletion or substitution. */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

const FIELD_WEIGHT = { title: 5, keywords: 3, body: 1 } as const;
const TYPE_BOOST: Partial<Record<DocType, number>> = { concept: 1.3, equation: 1.2, definition: 1.2, algorithm: 1.2, section: 1, unit: 1.1 };

export interface SearchIndex {
  docs: Map<string, SearchDoc>;
  postings: Map<string, Map<string, number>>; // term -> doc id -> weighted term frequency
  terms: string[]; // sorted, for prefix and fuzzy lookups
}

export function buildIndex(docs: SearchDoc[]): SearchIndex {
  const postings = new Map<string, Map<string, number>>();
  const map = new Map<string, SearchDoc>();
  for (const d of docs) {
    if (map.has(d.id)) throw new Error(`duplicate search doc id ${d.id}`);
    map.set(d.id, d);
    const fields: [keyof typeof FIELD_WEIGHT, string][] = [
      ["title", d.title],
      ["keywords", (d.keywords ?? []).join(" ")],
      ["body", d.body ?? ""],
    ];
    for (const [field, text] of fields)
      for (const t of tokenize(text)) {
        const row = postings.get(t) ?? new Map<string, number>();
        row.set(d.id, (row.get(d.id) ?? 0) + FIELD_WEIGHT[field]);
        postings.set(t, row);
      }
  }
  return { docs: map, postings, terms: [...postings.keys()].sort() };
}

function expand(token: string): string[] {
  const raw = token.toLowerCase();
  return SYNONYMS[raw] ? [stem(raw), ...SYNONYMS[raw].map(stem)] : [stem(raw)];
}

/** Matching index terms for one query term, with a match-quality factor. */
function matchTerms(index: SearchIndex, term: string, isLast: boolean): [string, number][] {
  const out: [string, number][] = [];
  if (index.postings.has(term)) out.push([term, 1]);
  if (isLast && term.length >= 2)
    for (const t of index.terms) if (t !== term && t.startsWith(term)) out.push([t, 0.7]); // search as you type
  if (term.length >= 5)
    for (const t of index.terms) if (t !== term && !t.startsWith(term) && withinOneEdit(t, term)) out.push([t, 0.5]); // typo
  return out;
}

export function search(index: SearchIndex, query: string, limit = 30): SearchHit[] {
  const raw = query
    .toLowerCase()
    .replace(/q-learning/g, "q learning")
    .split(/[^a-z0-9εγλ]+/)
    .filter((t) => t && !STOP.has(t));
  if (!raw.length) return [];
  const scores = new Map<string, number>();
  const matchedGroups = new Map<string, number>(); // how many query words each doc matched
  raw.forEach((word, wi) => {
    const hitThisWord = new Set<string>();
    for (const term of expand(word))
      for (const [t, quality] of matchTerms(index, term, wi === raw.length - 1))
        for (const [id, tf] of index.postings.get(t)!) {
          scores.set(id, (scores.get(id) ?? 0) + tf * quality);
          hitThisWord.add(id);
        }
    for (const id of hitThisWord) matchedGroups.set(id, (matchedGroups.get(id) ?? 0) + 1);
  });
  const direct: SearchHit[] = [];
  for (const [id, s] of scores) {
    const doc = index.docs.get(id)!;
    const coverage = matchedGroups.get(id)! / raw.length; // reward docs that match every query word
    const phrase = doc.title.toLowerCase().includes(query.trim().toLowerCase()) ? 2 : 1;
    direct.push({ doc, score: s * coverage * coverage * phrase * (TYPE_BOOST[doc.type] ?? 1) });
  }
  direct.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title));
  const seen = new Set(direct.map((h) => h.doc.id));
  const cross: SearchHit[] = [];
  for (const h of direct.slice(0, 8))
    for (const r of h.doc.related ?? []) {
      const doc = index.docs.get(r);
      if (doc && !seen.has(r)) {
        seen.add(r);
        cross.push({ doc, score: h.score * 0.35, via: h.doc.id });
      }
    }
  return [...direct, ...cross].sort((a, b) => b.score - a.score).slice(0, limit);
}
