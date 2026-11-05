// The content catalogue and per-unit content (Milestone 3A, D-031).
//
// content/ stays the single source of truth (D-001). At build time the Vite plugin in tools/vite_content.ts
// derives two things from it with the pure functions below:
//   - the CATALOGUE: small, loaded with the app shell. The source page tables, the curriculum, and a stub per
//     concept, item and question (ids, titles, units, links), which is enough for navigation, the dashboard,
//     progress, revision counts and cross-links.
//   - one chunk per UNIT: the full concepts, equations, algorithms, examples, figures, lesson and questions
//     of that chapter or module, fetched only when a page needs them.
// Supplementary units are separate chunks, so core pages never download supplementary content.
import {
  SELF_MARKED_TYPES,
  type Algorithm, type Concept, type ConceptKind, type ContentBundle, type Curriculum, type Equation, type Example, type Figure,
  type Lesson, type NotationEntry, type ProvenanceKind, type QuestionCategory, type QuestionFile, type QuestionType, type Sources,
} from "./schema.ts";

export interface ConceptStub {
  id: string;
  unit: string;
  title: string;
  kind: ConceptKind;
  prereqs: string[];
}
export type ItemKind = "equation" | "algorithm" | "example" | "figure";
export interface ItemStub {
  id: string;
  unit: string;
  kind: ItemKind;
  title: string;
  bookLabel?: string;
  concepts: string[];
}
export interface QuestionStub {
  id: string;
  unit: string;
  section: string | null;
  concepts: string[];
  type: QuestionType;
  category: QuestionCategory;
  difficulty: number;
  marks: number;
  provenance: ProvenanceKind;
  selfMarked: boolean;
}

/** Sources as the browser needs them: the exercise registry is for the validator only. */
export type BrowserSources = Omit<Sources, "sb"> & { sb: Omit<Sources["sb"], "exercises"> };

export interface Catalog {
  sources: BrowserSources;
  curriculum: Curriculum;
  concepts: ConceptStub[];
  items: ItemStub[];
  questions: QuestionStub[];
  notationCount: number;
  /** Units that have content files; every other unit has nothing to load. */
  contentUnits: string[];
  /** Other units whose items a unit's lessons show in full (lesson refs), loaded together with it. */
  deps: Record<string, string[]>;
}

export interface UnitContent {
  unit: string;
  concepts: Concept[];
  equations: Equation[];
  algorithms: Algorithm[];
  examples: Example[];
  figures: Figure[];
  lessons: Lesson[];
  questionFiles: QuestionFile[];
}

export const emptyUnit = (unit: string): UnitContent => ({ unit, concepts: [], equations: [], algorithms: [], examples: [], figures: [], lessons: [], questionFiles: [] });

const sortedUnique = (xs: string[]) => [...new Set(xs)].sort();

export function buildCatalog(b: ContentBundle): Catalog {
  const questions = b.questionFiles.flatMap((f) => f.questions);
  const items: ItemStub[] = [
    ...b.equations.map((e) => ({ id: e.id, unit: e.unit, kind: "equation" as const, title: e.name, bookLabel: e.bookLabel, concepts: [e.concept] })),
    ...b.algorithms.map((a) => ({ id: a.id, unit: a.unit, kind: "algorithm" as const, title: a.name, bookLabel: a.bookLabel, concepts: [a.concept] })),
    ...b.examples.map((x) => ({ id: x.id, unit: x.unit, kind: "example" as const, title: x.title, bookLabel: x.bookLabel, concepts: x.concepts })),
    ...b.figures.map((f) => ({ id: f.id, unit: f.unit, kind: "figure" as const, title: f.title, bookLabel: f.bookLabel, concepts: f.concepts })),
  ].map((s) => (s.bookLabel === undefined ? (({ bookLabel: _, ...rest }) => rest)(s) : s));
  const itemUnit = new Map(items.map((i) => [i.id, i.unit]));
  const contentUnits = sortedUnique([
    ...b.concepts.map((c) => c.unit), ...items.map((i) => i.unit), ...b.lessons.map((l) => l.unit), ...b.questionFiles.map((f) => f.unit),
  ]);
  const deps: Record<string, string[]> = {};
  for (const l of b.lessons) {
    const other = l.sections.flatMap((s) => s.layers.flatMap((ly) => ly.refs ?? [])).map((r) => itemUnit.get(r)).filter((u): u is string => !!u && u !== l.unit);
    if (other.length) deps[l.unit] = sortedUnique(other);
  }
  const { exercises: _exercises, ...sb } = b.sources.sb;
  return {
    sources: { ...b.sources, sb },
    curriculum: b.curriculum,
    concepts: b.concepts.map((c) => ({ id: c.id, unit: c.unit, title: c.title, kind: c.kind, prereqs: c.prereqs })),
    items,
    questions: questions.map((q) => ({
      id: q.id, unit: q.unit, section: q.section, concepts: q.concepts, type: q.type, category: q.category, difficulty: q.difficulty, marks: q.marks,
      provenance: q.provenance.kind, selfMarked: (SELF_MARKED_TYPES as readonly string[]).includes(q.type),
    })),
    notationCount: b.notation.length,
    contentUnits,
    deps,
  };
}

export function unitContent(b: ContentBundle, unit: string): UnitContent {
  const mine = <T extends { unit: string }>(xs: T[]) => xs.filter((x) => x.unit === unit);
  return {
    unit,
    concepts: mine(b.concepts),
    equations: mine(b.equations),
    algorithms: mine(b.algorithms),
    examples: mine(b.examples),
    figures: mine(b.figures),
    lessons: mine(b.lessons),
    questionFiles: mine(b.questionFiles),
  };
}

/** A ContentBundle holding only the loaded units, for buildIndexes(). Exercises are not needed in the browser. */
export function bundleFrom(c: Catalog, parts: UnitContent[], notation: NotationEntry[] = []): ContentBundle {
  const all = <K extends keyof Omit<UnitContent, "unit">>(k: K) => parts.flatMap((p) => p[k] as unknown[]) as UnitContent[K];
  return {
    sources: { ...c.sources, sb: { ...c.sources.sb, exercises: [] } },
    curriculum: c.curriculum,
    notation,
    concepts: all("concepts"),
    equations: all("equations"),
    algorithms: all("algorithms"),
    examples: all("examples"),
    figures: all("figures"),
    lessons: all("lessons"),
    questionFiles: all("questionFiles"),
  };
}
