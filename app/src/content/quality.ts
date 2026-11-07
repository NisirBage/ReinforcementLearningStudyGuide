// Content quality checks that look across the whole bundle (Milestone 4A, D-042). Run by `npm run validate`.
//   errors    links written inside Markdown text that do not resolve; control characters; TeX that KaTeX cannot
//             parse; identical question stems; equation and example labels that the draft does not have where
//             the item says it is.
//   warnings  near-duplicate questions; equations no lesson, question or explainer uses; lesson references to
//             items outside the section's concepts and their prerequisites. Listed with --warnings.
import { renderMarkdown, renderTex, texHasError } from "../lib/renderCore";
import type { Inventory } from "./coverage";
import { findSection, isSupplementaryUnit, type ContentBundle } from "./schema";

/** Routes a content link may point at besides items, concepts, units and labs. */
const PLAIN_ROUTES = ["#/", "#/learn", "#/practice", "#/exam", "#/lab", "#/search", "#/revision", "#/revision/review", "#/revision/equations", "#/revision/algorithms", "#/revision/notation", "#/progress"];

/** Every string in a value, with a readable path and the key it sits under. */
function* strings(v: unknown, path: string, key = ""): Generator<{ s: string; path: string; key: string }> {
  if (typeof v === "string") yield { s: v, path, key };
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* strings(v[i], `${path}[${i}]`, key);
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (k !== "$comment") yield* strings(x, `${path}.${k}`, k);
}

// KaTeX is the slow part of these checks; a string's verdict never changes, so it is computed once per process.
const texVerdict = new Map<string, boolean>();
const badTex = (s: string, raw: boolean) => {
  const k = (raw ? "T" : "M") + s;
  let v = texVerdict.get(k);
  if (v === undefined) texVerdict.set(k, (v = texHasError(raw ? renderTex(s, true) : renderMarkdown(s))));
  return v;
};

const words = (s: string) => s.toLowerCase().replace(/\$[^$]*\$/g, " ").replace(/[^a-z0-9α-ωε ]+/g, " ").split(/\s+/).filter(Boolean);
const normStem = (s: string) => words(s).join(" ");
const jaccard = (a: Set<string>, b: Set<string>) => {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n / (a.size + b.size - n || 1);
};

export function qualityChecks(b: ContentBundle, inv: Inventory): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const concepts = new Map(b.concepts.map((c) => [c.id, c]));
  const items = new Map<string, { kind: string; unit: string; concepts: string[] }>([
    ...b.equations.map((e) => [e.id, { kind: "equation", unit: e.unit, concepts: [e.concept] }] as [string, { kind: string; unit: string; concepts: string[] }]),
    ...b.algorithms.map((a) => [a.id, { kind: "algorithm", unit: a.unit, concepts: [a.concept] }] as [string, { kind: string; unit: string; concepts: string[] }]),
    ...b.examples.map((x) => [x.id, { kind: "example", unit: x.unit, concepts: x.concepts }] as [string, { kind: string; unit: string; concepts: string[] }]),
    ...b.figures.map((f) => [f.id, { kind: "figure", unit: f.unit, concepts: f.concepts }] as [string, { kind: string; unit: string; concepts: string[] }]),
  ]);
  const units = new Map([...b.curriculum.core.map((u) => [u.id, u.chapter] as const), ...b.curriculum.supplementary.map((u) => [u.id, null] as const)]);
  const labs = new Set(b.labs.map((l) => l.slug));

  const linkOk = (t: string): string | null => {
    if (/^https?:/i.test(t)) return "external links are not allowed: the app works offline and cites sources instead";
    if (!t.startsWith("#/")) return "links must be in-app routes starting with #/";
    const path = "#" + t.slice(1).split("?")[0]; // query strings (?concept=…) are allowed on any route
    if (PLAIN_ROUTES.includes(path)) return null;
    const [, kind, id, sub] = path.split("/");
    if (kind === "concept") return concepts.has(id) ? null : `unknown concept ${id}`;
    if (["equation", "algorithm", "example", "figure"].includes(kind)) return items.get(id)?.kind === kind ? null : `unknown ${kind} ${id}`;
    if (kind === "lab") return labs.has(id) ? null : `unknown lab ${id}`;
    if (kind === "learn") {
      if (!units.has(id)) return `unknown unit ${id}`;
      if (sub === undefined) return null;
      const ch = units.get(id);
      return ch ? (findSection(b.sources, "sb", sub) && sub.startsWith(ch + ".") ? null : `§${sub} is not a section of ${id}`) : findSection(b.sources, "zhao", sub) ? null : `unknown section ${sub}`;
    }
    return `unknown route ${path}`;
  };

  const all = { concepts: b.concepts, equations: b.equations, algorithms: b.algorithms, examples: b.examples, figures: b.figures, labs: b.labs, lessons: b.lessons, questions: b.questionFiles, notation: b.notation };
  for (const { s, path, key } of strings(all, "content")) {
    // Control characters other than newlines: almost always a JSON escape (\t, \f, \b) written where TeX meant \tfrac, \frac, \beta.
    const cc = /[\u0000-\u0009\u000b-\u001f]/.exec(s);
    if (cc) errors.push(`${path}: control character U+${cc[0].charCodeAt(0).toString(16).padStart(4, "0")} (a JSON escape where TeX was meant?) in "${s.slice(0, 40)}…"`);
    if (key === "tex" || key === "tex2018") {
      if (badTex(s, true)) errors.push(`${path}: KaTeX cannot parse "${s.slice(0, 60)}"`);
    } else if (s.includes("$") && badTex(s, false)) errors.push(`${path}: KaTeX cannot parse the maths in "${s.slice(0, 60)}…" (write money as "100", not "\\$100")`);
    for (const m of s.matchAll(/\]\(([^)\s]+)\)/g)) {
      const why = linkOk(m[1]);
      if (why) errors.push(`${path}: link ${m[1]}: ${why}`);
    }
  }

  // Questions: identical stems are errors; near-identical ones on the same side of the core line are warnings.
  const qs = b.questionFiles.flatMap((f) => f.questions);
  const seen = new Map<string, string>();
  for (const q of qs) {
    const n = normStem(q.stem);
    if (seen.has(n)) errors.push(`question ${q.id}: same stem as ${seen.get(n)}`);
    else seen.set(n, q.id);
  }
  const sets = qs.map((q) => ({ q, w: new Set(words(q.stem)) })).filter((x) => x.w.size >= 8);
  for (let i = 0; i < sets.length; i++)
    for (let j = i + 1; j < sets.length; j++) {
      const a = sets[i], c = sets[j];
      if (isSupplementaryUnit(a.q.unit) !== isSupplementaryUnit(c.q.unit) || normStem(a.q.stem) === normStem(c.q.stem)) continue;
      const sim = jaccard(a.w, c.w);
      if (sim >= 0.85) warnings.push(`questions ${a.q.id} and ${c.q.id} are near duplicates (${Math.round(sim * 100)}% of their words shared)`);
    }

  // Book labels must exist in the draft, in the section the item cites.
  const invSection = new Map<string, string>(); // "eq:3.16" or "ex:3.8" → section id
  for (const c of inv.chapters)
    for (const s of [{ ...c.intro, id: `${c.id}.intro` }, ...c.sections]) {
      for (const e of s.equations) invSection.set(`eq:${e}`, s.id);
      for (const e of s.examples) invSection.set(`ex:${e}`, s.id);
    }
  // A label in a chapter's introduction may be cited from any section of that chapter.
  const placed = (sec: string, cited: string[]) => !cited.length || cited.includes(sec) || (sec.endsWith(".intro") && cited.every((c) => c.startsWith(sec.replace(".intro", "."))));
  const sectionsCited = (x: { sources: { kind: string; section?: string }[] }) => x.sources.filter((r) => r.kind === "textbook" && r.section).map((r) => r.section!);
  for (const e of b.equations) {
    if (isSupplementaryUnit(e.unit) || !e.bookLabel) continue;
    for (const [, n] of e.bookLabel.matchAll(/\((\d+\.\d+)\)/g)) {
      const sec = invSection.get(`eq:${n}`);
      if (!sec) errors.push(`equation ${e.id}: the draft has no numbered equation (${n})`);
      else if (!placed(sec, sectionsCited(e))) errors.push(`equation ${e.id}: (${n}) is in §${sec}, but the item cites ${sectionsCited(e).map((s) => "§" + s).join(", ")}`);
    }
  }
  for (const x of b.examples) {
    if (isSupplementaryUnit(x.unit) || !x.bookLabel) continue;
    for (const [, n] of x.bookLabel.matchAll(/Example (\d+\.\d+)/g)) {
      const sec = invSection.get(`ex:${n}`);
      if (!sec) errors.push(`example ${x.id}: the draft has no Example ${n}`);
      else if (!placed(sec, sectionsCited(x))) errors.push(`example ${x.id}: Example ${n} is in §${sec}, but the item cites ${sectionsCited(x).map((s) => "§" + s).join(", ")}`);
    }
  }

  // Equations should be taught or practised somewhere, not only listed.
  const used = new Set<string>([
    ...b.lessons.flatMap((l) => l.sections.flatMap((s) => s.layers.flatMap((ly) => ly.refs ?? []))),
    ...qs.flatMap((q) => (q.provenance.kind === "textbook-derived" || q.provenance.kind === "generated" || q.provenance.kind === "supplementary" ? (q.provenance.basis ?? []) : [])),
    ...b.algorithms.flatMap((a) => a.explainer?.equations ?? []),
  ]);
  for (const e of b.equations) if (!used.has(e.id)) warnings.push(`equation ${e.id}: not used by any lesson, question or explainer`);

  // A lesson should only lean on items from its own concepts or their prerequisites.
  const closure = (ids: string[]) => {
    const out = new Set<string>();
    const go = (id: string) => {
      if (out.has(id)) return;
      out.add(id);
      for (const p of concepts.get(id)?.prereqs ?? []) go(p);
    };
    ids.forEach(go);
    return out;
  };
  for (const l of b.lessons)
    for (const s of l.sections) {
      const ok = closure(s.concepts);
      for (const ly of s.layers)
        for (const r of ly.refs ?? []) {
          const it = items.get(r);
          if (it && !it.concepts.some((c) => ok.has(c))) warnings.push(`lesson ${s.id}: ${r} belongs to ${it.concepts.join(", ")}, outside the section's concepts and their prerequisites`);
        }
    }
  return { errors, warnings };
}
