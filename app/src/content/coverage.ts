// How much of the April 2015 draft the app covers, section by section (Milestone 4A, D-042).
//
// Three inputs:
//   inventory     content/source/inventory.json, generated from the draft (tools/build_inventory.py): each section's
//                 numbered equations, named examples, figure captions and length. Numbers only, never the book's text.
//   declarations  content/coverage/coverage.json: what cannot be computed. A section studied through a reading
//                 guide, an example reproduced by a lab check instead of a worked-example item, and each exercise
//                 that is not a bank question (a placeholder in the draft, or a programming task done in a lab).
//   the content   lessons, equations, examples and questions, matched to sections by their book labels and sources.
//
// A section is "covered" only when every criterion holds; anything less is "partial" with the reasons listed.
// Nothing here can mark a section covered by declaration alone.
import { isSupplementaryUnit, type ContentBundle } from "./schema.ts";

export interface InventorySection {
  id: string;
  words: number;
  equations: string[]; // "3.16"
  examples: string[]; // "3.8"
  figures: string[]; // "3.4" (captions found in the section)
}
export type InventoryPart = Omit<InventorySection, "id">;
export interface Inventory {
  source: "sb";
  chapters: { id: string; intro: InventoryPart; sections: InventorySection[] }[];
}

export const TREATMENTS = ["full", "reading-guide"] as const;
export const EXERCISE_DISPOSITIONS = ["placeholder", "lab-task"] as const;
export interface CoverageDeclarations {
  sections?: Record<string, { treatment: (typeof TREATMENTS)[number]; note: string }>;
  examples?: Record<string, { check: string; lab?: string; note?: string }>;
  exercises?: Record<string, { disposition: (typeof EXERCISE_DISPOSITIONS)[number]; lab?: string; note: string }>;
  thin?: Record<string, string>; // sections that are short or incomplete in the draft itself, with a note
}

export type SectionStatus = "unwritten" | "not-started" | "partial" | "covered";
export interface SectionCoverage {
  id: string;
  title: string;
  status: SectionStatus;
  treatment: (typeof TREATMENTS)[number];
  words: number;
  lessonLayers: string[];
  equations: { expected: string[]; present: string[] };
  examples: { expected: string[]; asItems: string[]; byLabCheck: string[] };
  figures: string[];
  questions: number;
  items: number; // concepts, equations, algorithms, examples, figures and labs citing the section
  missing: string[]; // why the section is not covered (empty when covered)
  thin?: string;
  note?: string;
}
export interface ChapterCoverage {
  id: string;
  title: string;
  unwritten: boolean; // title page only in the draft
  /** The chapter's opening text before its first section: its equations and examples count like a section's. */
  intro: { words: number; equations: { expected: string[]; present: string[] }; examples: { expected: string[]; asItems: string[]; byLabCheck: string[] }; missing: string[] };
  sections: SectionCoverage[];
  exercises: { total: number; inBank: string[]; declared: Record<string, string>; missing: string[] };
  status: SectionStatus;
}

const labels = (s: string | undefined, re: RegExp) => [...(s ?? "").matchAll(re)].map((m) => m[1]);
const EQ_LABEL = /\((\d+\.\d+)\)/g;
const EX_LABEL = /Example (\d+\.\d+)/g;

const cites = (x: { sources?: { kind: string; section?: string }[] }, section: string) => (x.sources ?? []).some((r) => r.kind === "textbook" && r.section === section);

export function computeCoverage(b: ContentBundle, inv: Inventory, decl: CoverageDeclarations): ChapterCoverage[] {
  const core = <T extends { unit: string }>(xs: T[]) => xs.filter((x) => !isSupplementaryUnit(x.unit));
  const eqLabels = new Map<string, string[]>(); // "3.16" → equation item ids
  for (const e of core(b.equations)) for (const l of labels(e.bookLabel, EQ_LABEL)) eqLabels.set(l, [...(eqLabels.get(l) ?? []), e.id]);
  const exLabels = new Set(core(b.examples).flatMap((x) => labels(x.bookLabel, EX_LABEL)));
  const questions = core(b.questionFiles.flatMap((f) => f.questions));
  const lessons = core(b.lessons).flatMap((l) => l.sections);
  const inBank = new Set(questions.flatMap((q) => (q.provenance.kind === "textbook-exercise" ? [q.provenance.exercise.replace(/^Exercise /, "")] : [])));
  const empty = new Set(b.curriculum.emptyInSource.map((e) => `${e.chapter}/${e.section ?? ""}`));
  const invById = new Map(inv.chapters.flatMap((c) => c.sections.map((s) => [s.id, s] as const)));
  const cited = [...core(b.concepts), ...core(b.equations), ...core(b.algorithms), ...core(b.examples), ...core(b.figures), ...core(b.labs)];

  return b.sources.sb.chapters.map((ch) => {
    const unwritten = empty.has(`${ch.id}/`);
    const sections: SectionCoverage[] = ch.sections.map((s) => {
      const iv = invById.get(s.id) ?? { id: s.id, words: 0, equations: [], examples: [], figures: [] };
      const treatment = decl.sections?.[s.id]?.treatment ?? "full";
      const lesson = lessons.find((l) => l.section === s.id);
      const lessonLayers = lesson ? lesson.layers.map((l) => l.layer) : [];
      const present = iv.equations.filter((n) => eqLabels.has(n));
      const asItems = iv.examples.filter((n) => exLabels.has(n));
      const byLabCheck = iv.examples.filter((n) => !exLabels.has(n) && decl.examples?.[n]);
      const nq = questions.filter((q) => q.section === s.id).length;
      const items = cited.filter((x) => cites(x as never, s.id)).length + (lesson ? 1 : 0);
      const missing: string[] = [];
      if (!lesson) missing.push("no lesson");
      else if (treatment === "full" && lessonLayers.length < 2) missing.push("lesson has a single layer");
      const eqGap = iv.equations.filter((n) => !eqLabels.has(n));
      if (eqGap.length) missing.push(`equations missing: ${eqGap.map((n) => `(${n})`).join(", ")}`);
      const exGap = iv.examples.filter((n) => !exLabels.has(n) && !decl.examples?.[n]);
      if (exGap.length) missing.push(`examples missing: ${exGap.map((n) => `Example ${n}`).join(", ")}`);
      if (nq === 0) missing.push("no questions");
      const isEmpty = empty.has(`${ch.id}/${s.id}`);
      const status: SectionStatus = isEmpty ? "unwritten" : missing.length === 0 ? "covered" : items + nq === 0 ? "not-started" : "partial";
      return {
        id: s.id, title: s.title, status, treatment, words: iv.words, lessonLayers,
        equations: { expected: iv.equations, present }, examples: { expected: iv.examples, asItems, byLabCheck }, figures: iv.figures,
        questions: nq, items, missing: isEmpty ? [] : missing,
        ...(decl.thin?.[s.id] ? { thin: decl.thin[s.id] } : {}),
        ...(decl.sections?.[s.id]?.note ? { note: decl.sections[s.id].note } : {}),
      };
    });
    const iv0 = inv.chapters.find((c) => c.id === ch.id)?.intro ?? { words: 0, equations: [], examples: [], figures: [] };
    const introMissing = [
      ...iv0.equations.filter((n) => !eqLabels.has(n)).map((n) => `introduction: equation (${n}) missing`),
      ...iv0.examples.filter((n) => !exLabels.has(n) && !decl.examples?.[n]).map((n) => `introduction: Example ${n} missing`),
    ];
    const intro = {
      words: iv0.words,
      equations: { expected: iv0.equations, present: iv0.equations.filter((n) => eqLabels.has(n)) },
      examples: { expected: iv0.examples, asItems: iv0.examples.filter((n) => exLabels.has(n)), byLabCheck: iv0.examples.filter((n) => !exLabels.has(n) && decl.examples?.[n]) },
      missing: unwritten ? [] : introMissing,
    };
    const exs = b.sources.sb.exercises.filter((e) => e.chapter === ch.id);
    const declared: Record<string, string> = {};
    for (const e of exs) if (!inBank.has(e.id) && decl.exercises?.[e.id]) declared[e.id] = decl.exercises[e.id].disposition;
    const exMissing = exs.filter((e) => !inBank.has(e.id) && !declared[e.id]).map((e) => e.id);
    const written = sections.filter((s) => s.status !== "unwritten");
    const status: SectionStatus = unwritten
      ? "unwritten"
      : written.every((s) => s.status === "covered") && exMissing.length === 0 && intro.missing.length === 0
        ? "covered"
        : written.every((s) => s.status === "not-started")
          ? "not-started"
          : "partial";
    return { id: ch.id, title: ch.title, unwritten, intro, sections, exercises: { total: exs.length, inBank: exs.filter((e) => inBank.has(e.id)).map((e) => e.id), declared, missing: exMissing }, status };
  });
}

/** What the browser needs for the coverage badges: one status per chapter and per section. */
export const coverageSummary = (cov: ChapterCoverage[]) => ({
  chapters: Object.fromEntries(cov.map((c) => [c.id, c.status])),
  sections: Object.fromEntries(cov.flatMap((c) => c.sections.map((s) => [s.id, s.status]))),
});
export type CoverageSummary = ReturnType<typeof coverageSummary>;

/** Checks the declarations file against the registry, the inventory, the checks and the labs. */
export function validateDeclarations(decl: CoverageDeclarations, b: ContentBundle, inv: Inventory, checks: Set<string>): string[] {
  const errs: string[] = [];
  const sectionIds = new Set(b.sources.sb.chapters.flatMap((c) => c.sections.map((s) => s.id)));
  const exampleIds = new Set(inv.chapters.flatMap((c) => [c.intro, ...c.sections].flatMap((s) => s.examples)));
  const exercises = new Map(b.sources.sb.exercises.map((e) => [e.id, e]));
  const labs = new Set(b.labs.map((l) => l.slug));
  const inBank = new Set(b.questionFiles.flatMap((f) => f.questions).flatMap((q) => (q.provenance.kind === "textbook-exercise" ? [q.provenance.exercise.replace(/^Exercise /, "")] : [])));
  const at = (k: string) => `coverage.json ${k}`;
  for (const [id, s] of Object.entries(decl.sections ?? {})) {
    if (!sectionIds.has(id)) errs.push(`${at("sections")}: unknown section ${id}`);
    if (!(TREATMENTS as readonly string[]).includes(s?.treatment) || typeof s?.note !== "string" || !s.note.trim()) errs.push(`${at("sections")}.${id}: needs a treatment (${TREATMENTS.join(", ")}) and a note`);
  }
  for (const [id, x] of Object.entries(decl.examples ?? {})) {
    if (!exampleIds.has(id)) errs.push(`${at("examples")}: Example ${id} is not in the inventory`);
    if (typeof x?.check !== "string" || !checks.has(x.check)) errs.push(`${at("examples")}.${id}: needs an existing check`);
    if (x?.lab !== undefined && !labs.has(x.lab)) errs.push(`${at("examples")}.${id}: unknown lab ${x.lab}`);
  }
  for (const [id, x] of Object.entries(decl.exercises ?? {})) {
    const e = exercises.get(id);
    if (!e) {
      errs.push(`${at("exercises")}: Exercise ${id} is not in the draft`);
      continue;
    }
    if (!(EXERCISE_DISPOSITIONS as readonly string[]).includes(x?.disposition) || typeof x?.note !== "string" || !x.note.trim()) errs.push(`${at("exercises")}.${id}: needs a disposition (${EXERCISE_DISPOSITIONS.join(", ")}) and a note`);
    if (x?.disposition === "placeholder" && !e.placeholder) errs.push(`${at("exercises")}.${id}: only exercises the registry marks as placeholders may be declared placeholders`);
    if (x?.disposition === "lab-task" && !(x.lab && labs.has(x.lab))) errs.push(`${at("exercises")}.${id}: a lab task must name an existing lab`);
    if (inBank.has(id)) errs.push(`${at("exercises")}.${id}: already a bank question; remove the declaration`);
  }
  for (const id of Object.keys(decl.thin ?? {})) if (!sectionIds.has(id)) errs.push(`${at("thin")}: unknown section ${id}`);
  return errs;
}
