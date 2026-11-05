// Read-only lookups over the content bundle, so pages ask "what belongs here?" instead of filtering ad hoc.
// Pure: the browser and the tests build the same indexes from the same bundle.
import {
  isSupplementaryUnit, sectionPages,
  type BookSource,
  type Algorithm, type ChapterEntry, type Concept, type ContentBundle, type CoreUnit, type Equation, type Example, type Figure,
  type LessonSection, type Question, type SectionEntry, type SourceRef, type SupplementaryUnit,
} from "./schema";
import type { Catalog, ItemKind } from "./catalog";

export interface UnitView {
  id: string;
  title: string;
  kind: "core" | "supplementary";
  status: "core" | "empty-in-draft" | "supplementary";
  chapter?: ChapterEntry; // textbook chapter (core) or the first Zhao chapter (supplementary)
  core?: CoreUnit;
  sup?: SupplementaryUnit;
}

export interface SectionContent {
  lesson?: LessonSection;
  concepts: Concept[];
  equations: Equation[];
  algorithms: Algorithm[];
  examples: Example[];
  figures: Figure[];
  questions: Question[];
}

type Item = { sources: SourceRef[] };
const citesSection = (it: Item, book: "textbook" | "zhao", section: string) => it.sources.some((s) => s.kind === book && s.section === section);
const citesChapterOnly = (it: Item, book: "textbook" | "zhao", chapter: string) =>
  it.sources.some((s) => s.kind === book && s.chapter === chapter && s.section === undefined);

/** Book structure only (sources + curriculum): the same in the catalogue and in a loaded bundle. */
export function structureIndex(sources: { sb: Omit<BookSource, never>; zhao: BookSource }, curriculum: ContentBundle["curriculum"]) {
  const units: UnitView[] = [
    ...curriculum.core.map((u) => ({
      id: u.id, title: u.title, kind: "core" as const, status: u.status, core: u, chapter: sources.sb.chapters.find((c) => c.id === u.chapter),
    })),
    ...curriculum.supplementary.map((u) => ({
      id: u.id, title: u.title, kind: "supplementary" as const, status: "supplementary" as const, sup: u,
      chapter: u.zhao?.length ? sources.zhao.chapters.find((c) => c.id === u.zhao![0]) : undefined,
    })),
  ];
  const unit = (id: string) => units.find((u) => u.id === id);

  /** Sections listed for a unit: the textbook chapter's sections, or the sections of the cited Zhao chapters. */
  function sectionsOf(id: string): { book: "sb" | "zhao"; chapter: ChapterEntry; section: SectionEntry }[] {
    const u = unit(id);
    if (!u) return [];
    if (u.kind === "core") return (u.chapter?.sections ?? []).map((section) => ({ book: "sb" as const, chapter: u.chapter!, section }));
    return (u.sup!.zhao ?? []).flatMap((z) => {
      const ch = sources.zhao.chapters.find((c) => c.id === z)!;
      return ch.sections.map((section) => ({ book: "zhao" as const, chapter: ch, section }));
    });
  }
  const supplementsFor = (chapter: string) => curriculum.supplementary.filter((s) => s.attachTo.chapter === chapter);
  const emptyNote = (chapter: string, section: string | null) => curriculum.emptyInSource.find((e) => e.chapter === chapter && e.section === section)?.note;
  const pagesOf = (book: "sb" | "zhao", sectionId: string) => sectionPages(sources as unknown as ContentBundle["sources"], book, sectionId);
  return { units, unit, sectionsOf, supplementsFor, emptyNote, pagesOf };
}

/** Every prerequisite, nearest first, without repeats. */
function chainOf<T extends { id: string; prereqs: string[] }>(byId: Map<string, T>, id: string): T[] {
  const out: T[] = [];
  const seen = new Set<string>([id]);
  let frontier = byId.get(id)?.prereqs ?? [];
  while (frontier.length) {
    const next: string[] = [];
    for (const p of frontier)
      if (!seen.has(p) && byId.has(p)) {
        seen.add(p);
        out.push(byId.get(p)!);
        next.push(...byId.get(p)!.prereqs);
      }
    frontier = next;
  }
  return out;
}

/**
 * Lookups over the catalogue (loaded with the app shell): navigation, counts, titles and cross-links, plus
 * which units a page must load. Never returns full content: that comes from buildIndexes() over loaded units.
 */
export function catalogIndex(c: Catalog) {
  const s = structureIndex(c.sources, c.curriculum);
  const concepts = new Map(c.concepts.map((x) => [x.id, x]));
  const items = new Map(c.items.map((x) => [x.id, x]));
  const questions = new Map(c.questions.map((x) => [x.id, x]));
  const has = new Set(c.contentUnits);
  const inUnit = <T extends { unit: string }>(xs: T[], id: string) => xs.filter((x) => x.unit === id);
  /** The unit that holds a concept, item or question, if the catalogue knows it. */
  const unitOf = (id: string) => concepts.get(id)?.unit ?? items.get(id)?.unit ?? questions.get(id)?.unit;
  /** Units to load to show `units` in full: themselves and the units their lessons show items from. Only units with content. */
  const withDeps = (units: string[]) => [...new Set(units.flatMap((u) => [u, ...(c.deps[u] ?? [])]))].filter((u) => has.has(u)).sort();
  return {
    ...s,
    catalog: c,
    concept: (id: string) => concepts.get(id),
    item: (id: string) => items.get(id),
    question: (id: string) => questions.get(id),
    unitOf,
    withDeps,
    hasContent: (unit: string) => has.has(unit),
    conceptsOf: (unitId: string) => inUnit(c.concepts, unitId),
    questionsOf: (unitId: string) => inUnit(c.questions, unitId),
    itemsOf: (kind: ItemKind) => c.items.filter((i) => i.kind === kind),
    dependents: (id: string) => c.concepts.filter((x) => x.prereqs.includes(id)),
    prereqChain: (id: string) => chainOf(concepts, id),
    /** Units holding the concept and every item or question about it (what its concept page shows). */
    unitsForConcept: (id: string) =>
      withDeps([concepts.get(id)?.unit, ...c.items.filter((i) => i.concepts.includes(id)).map((i) => i.unit), ...c.questions.filter((q) => q.concepts.includes(id)).map((q) => q.unit)].filter((u): u is string => !!u)),
    /** Ids of revision cards: one per concept and one per equation (same as buildIndexes().cardIds). */
    cardIds: () => [...c.concepts.map((x) => `card:${x.id}`), ...c.items.filter((i) => i.kind === "equation").map((i) => `card:${i.id}`)],
  };
}

export type CatalogIndex = ReturnType<typeof catalogIndex>;

export function buildIndexes(b: ContentBundle) {
  const questions = b.questionFiles.flatMap((f) => f.questions);
  const concepts = new Map(b.concepts.map((c) => [c.id, c]));
  const { units, unit, sectionsOf, supplementsFor, emptyNote, pagesOf } = structureIndex(b.sources, b.curriculum);
  const inUnit = <T extends { unit: string }>(xs: T[], id: string) => xs.filter((x) => x.unit === id);

  function sectionContent(unitId: string, sectionId: string): SectionContent {
    const book = isSupplementaryUnit(unitId) ? "zhao" : "textbook";
    const own = <T extends { unit: string } & Item>(xs: T[]) => inUnit(xs, unitId).filter((x) => citesSection(x, book, sectionId));
    const lesson = b.lessons.find((l) => l.unit === unitId)?.sections.find((s) => s.section === sectionId);
    return {
      lesson,
      concepts: own(b.concepts),
      equations: own(b.equations),
      algorithms: own(b.algorithms),
      examples: own(b.examples),
      figures: own(b.figures),
      questions: own(questions),
    };
  }

  /** Items of a unit that cite its chapter as a whole (e.g. end-of-chapter exercises) or only lecture/paper sources. */
  function chapterLevel(unitId: string) {
    const u = unit(unitId);
    const book = u?.kind === "supplementary" ? "zhao" : "textbook";
    const chapter = u?.kind === "core" ? u.core!.chapter : u?.sup?.zhao?.[0] ?? "";
    const loose = (it: Item) => citesChapterOnly(it, book, chapter) || it.sources.every((s) => s.kind === "lecture" || s.kind === "paper");
    return { questions: inUnit(questions, unitId).filter(loose), concepts: inUnit(b.concepts, unitId).filter(loose) };
  }

  /** Concepts that list `id` as a prerequisite (what this concept unlocks). */
  const dependents = (id: string) => b.concepts.filter((c) => c.prereqs.includes(id));
  const prereqChain = (id: string): Concept[] => chainOf(concepts, id);

  return {
    bundle: b,
    units,
    unit,
    questions,
    concept: (id: string) => concepts.get(id),
    equation: (id: string) => b.equations.find((e) => e.id === id),
    algorithm: (id: string) => b.algorithms.find((a) => a.id === id),
    example: (id: string) => b.examples.find((x) => x.id === id),
    figure: (id: string) => b.figures.find((f) => f.id === id),
    question: (id: string) => questions.find((q) => q.id === id),
    item: (id: string) => b.equations.find((e) => e.id === id) ?? b.algorithms.find((a) => a.id === id) ?? b.examples.find((x) => x.id === id) ?? b.figures.find((f) => f.id === id),
    conceptsOf: (unitId: string) => inUnit(b.concepts, unitId),
    questionsOf: (unitId: string) => inUnit(questions, unitId),
    equationsFor: (conceptId: string) => b.equations.filter((e) => e.concept === conceptId),
    algorithmsFor: (conceptId: string) => b.algorithms.filter((a) => a.concept === conceptId),
    examplesFor: (conceptId: string) => b.examples.filter((x) => x.concepts.includes(conceptId)),
    figuresFor: (conceptId: string) => b.figures.filter((f) => f.concepts.includes(conceptId)),
    questionsFor: (conceptId: string) => questions.filter((q) => q.concepts.includes(conceptId)),
    sectionsOf,
    sectionContent,
    chapterLevel,
    dependents,
    prereqChain,
    supplementsFor,
    emptyNote,
    pagesOf,
    /** Ids of revision cards: one per concept and one per equation. */
    cardIds: () => [...b.concepts.map((c) => `card:${c.id}`), ...b.equations.map((e) => `card:${e.id}`)],
  };
}

export type Indexes = ReturnType<typeof buildIndexes>;
