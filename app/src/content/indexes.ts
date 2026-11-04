// Read-only lookups over the content bundle, so pages ask "what belongs here?" instead of filtering ad hoc.
// Pure: the browser and the tests build the same indexes from the same bundle.
import {
  isSupplementaryUnit, sectionPages,
  type Algorithm, type ChapterEntry, type Concept, type ContentBundle, type CoreUnit, type Equation, type Example, type Figure,
  type LessonSection, type Question, type SectionEntry, type SourceRef, type SupplementaryUnit,
} from "./schema";

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

export function buildIndexes(b: ContentBundle) {
  const questions = b.questionFiles.flatMap((f) => f.questions);
  const concepts = new Map(b.concepts.map((c) => [c.id, c]));
  const units: UnitView[] = [
    ...b.curriculum.core.map((u) => ({
      id: u.id, title: u.title, kind: "core" as const, status: u.status, core: u, chapter: b.sources.sb.chapters.find((c) => c.id === u.chapter),
    })),
    ...b.curriculum.supplementary.map((u) => ({
      id: u.id, title: u.title, kind: "supplementary" as const, status: "supplementary" as const, sup: u,
      chapter: u.zhao?.length ? b.sources.zhao.chapters.find((c) => c.id === u.zhao![0]) : undefined,
    })),
  ];
  const unit = (id: string) => units.find((u) => u.id === id);
  const inUnit = <T extends { unit: string }>(xs: T[], id: string) => xs.filter((x) => x.unit === id);

  /** Sections listed for a unit: the textbook chapter's sections, or the sections of the cited Zhao chapters. */
  function sectionsOf(id: string): { book: "sb" | "zhao"; chapter: ChapterEntry; section: SectionEntry }[] {
    const u = unit(id);
    if (!u) return [];
    if (u.kind === "core") return (u.chapter?.sections ?? []).map((section) => ({ book: "sb" as const, chapter: u.chapter!, section }));
    return (u.sup!.zhao ?? []).flatMap((z) => {
      const ch = b.sources.zhao.chapters.find((c) => c.id === z)!;
      return ch.sections.map((section) => ({ book: "zhao" as const, chapter: ch, section }));
    });
  }

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
  /** Every prerequisite, nearest first, without repeats. */
  function prereqChain(id: string): Concept[] {
    const out: Concept[] = [];
    const seen = new Set<string>([id]);
    let frontier = concepts.get(id)?.prereqs ?? [];
    while (frontier.length) {
      const next: string[] = [];
      for (const p of frontier)
        if (!seen.has(p) && concepts.has(p)) {
          seen.add(p);
          out.push(concepts.get(p)!);
          next.push(...concepts.get(p)!.prereqs);
        }
      frontier = next;
    }
    return out;
  }

  const supplementsFor = (chapter: string) => b.curriculum.supplementary.filter((s) => s.attachTo.chapter === chapter);
  const emptyNote = (chapter: string, section: string | null) => b.curriculum.emptyInSource.find((e) => e.chapter === chapter && e.section === section)?.note;
  const pagesOf = (book: "sb" | "zhao", sectionId: string) => sectionPages(b.sources, book, sectionId);

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
