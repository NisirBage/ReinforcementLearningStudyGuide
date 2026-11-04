// Turns the content bundle into search documents. Pure, so the same index is built in the browser and in tests.
import type { SearchDoc } from "../domain/search";
import { isSupplementaryUnit, sectionPages, type ContentBundle, type SourceRef } from "./schema";

const span = (a: number | string, b: number | string) => (a === b ? `p. ${a}` : `pp. ${a}–${b}`);
const pdfSpan = ([a, b]: [number, number]) => (a === b ? `PDF ${a}` : `PDF ${a}–${b}`);

/** "S&B 2015 §2.3 · p. 37 (PDF 51)", "Zhao §6.2 · p. 104 (Ch 6 PDF 4)", "Lecture 6 · slides 18–21", "Paper · …". */
export function describeSource(r: SourceRef): string {
  switch (r.kind) {
    case "textbook":
      return `S&B 2015 ${r.section ? "§" + r.section : "Ch " + r.chapter} · ${span(...r.printedPages)} (${pdfSpan(r.pdfPages)})`;
    case "textbook-matter":
      return `S&B 2015 ${r.matter} · ${span(...r.printedPages)} (${pdfSpan(r.pdfPages)})`;
    case "zhao":
      return `Zhao ${r.section ? "§" + r.section : "Ch " + r.chapter} · ${span(...r.printedPages)} (Ch ${r.chapter} ${pdfSpan(r.pdfPages)})`;
    case "lecture":
      return `Lecture ${r.lecture.slice(1)} · ${r.slides[0] === r.slides[1] ? "slide " + r.slides[0] : `slides ${r.slides[0]}–${r.slides[1]}`}`;
    case "paper":
      return `Paper · ${r.citation}`;
  }
}

const tierOf = (unit: string) => (isSupplementaryUnit(unit) ? "supplementary" : "core") as SearchDoc["tier"];
const where = (refs: SourceRef[], unit: string) => (isSupplementaryUnit(unit) ? "Supplementary · " : "") + refs.map(describeSource).join(" · ");

export function buildSearchDocs(b: ContentBundle): SearchDoc[] {
  const docs: SearchDoc[] = [];
  const off = b.sources.sb.pdfPageOffset ?? 0;
  const empty = (chapter: string, section: string | null) => b.curriculum.emptyInSource.find((e) => e.chapter === chapter && e.section === section)?.note;

  for (const c of b.sources.sb.chapters) {
    const unit = `ch${c.id.padStart(2, "0")}`;
    docs.push({
      id: `sb:${c.id}`,
      type: "chapter",
      title: `Chapter ${c.id}: ${c.title}`,
      body: empty(c.id, null),
      ref: `S&B 2015 Ch ${c.id} · ${span(c.startPage, c.endPage)} (${pdfSpan([c.startPage + off, c.endPage + off])})`,
      href: `/learn/${unit}`,
      tier: "core",
    });
    for (const s of c.sections) {
      const pages = sectionPages(b.sources, "sb", s.id);
      docs.push({
        id: `sb:${s.id}`,
        type: "section",
        title: `${s.id} ${s.title}`,
        body: empty(c.id, s.id) ?? (s.optional ? "Marked ∗ (optional on first reading)." : undefined),
        ref: pages ? `S&B 2015 §${s.id} · ${span(...pages)} (${pdfSpan([pages[0] + off, pages[1] + off])})` : `S&B 2015 §${s.id}`,
        href: `/learn/${unit}#s-${s.id}`,
        related: [`sb:${c.id}`],
        tier: "core",
      });
    }
  }
  for (const u of b.curriculum.supplementary)
    docs.push({
      id: `unit:${u.id}`,
      type: "unit",
      title: u.title,
      body: [...(u.zhao ?? []).map((z) => `Zhao chapter ${z}`), ...(u.lectures ?? []).map((l) => `Lecture ${l.slice(1)}`), ...(u.papers ?? [])].join("; "),
      ref: `Supplementary · attached to S&B 2015 ${u.attachTo.section ? "§" + u.attachTo.section : "Ch " + u.attachTo.chapter}`,
      href: `/learn/${u.id}`,
      related: [u.attachTo.section ? `sb:${u.attachTo.section}` : `sb:${u.attachTo.chapter}`],
      tier: "supplementary",
    });
  const conceptDoc = (id: string) => `concept:${id}`;
  for (const c of b.concepts)
    docs.push({
      id: conceptDoc(c.id),
      type: c.kind === "definition" ? "definition" : c.kind === "algorithm" ? "algorithm" : c.kind === "example" ? "example" : "concept",
      title: c.title,
      body: c.summary,
      keywords: c.keywords,
      ref: where(c.sources, c.unit),
      href: `/learn/${c.unit}#${c.id}`,
      related: [...c.related, ...c.prereqs].map(conceptDoc),
      tier: tierOf(c.unit),
    });
  // Concepts that list a concept as related or prerequisite should surface it too (edges both ways).
  const byId = new Map(docs.map((d) => [d.id, d]));
  for (const c of b.concepts)
    for (const r of [...c.related, ...c.prereqs]) {
      const d = byId.get(conceptDoc(r));
      if (d && !d.related!.includes(conceptDoc(c.id))) d.related!.push(conceptDoc(c.id));
    }
  for (const e of b.equations)
    docs.push({
      id: `equation:${e.id}`,
      type: "equation",
      title: `${e.name}${e.bookLabel ? " " + e.bookLabel : ""}`,
      body: e.intuition,
      keywords: [...e.symbols.map((s) => s.meaning), ...(e.bookLabel ? [e.bookLabel.replace(/[()]/g, ""), "eq " + e.bookLabel] : [])],
      ref: where(e.sources, e.unit),
      href: `/revision/equations#${e.id}`,
      related: [conceptDoc(e.concept)],
      tier: tierOf(e.unit),
    });
  for (const a of b.algorithms)
    docs.push({
      id: `algorithm:${a.id}`,
      type: "algorithm",
      title: `${a.name}${a.bookLabel ? " (" + a.bookLabel + ")" : ""}`,
      keywords: [a.bookLabel ?? "", "pseudocode"],
      ref: where(a.sources, a.unit),
      href: `/revision/algorithms#${a.id}`,
      related: [conceptDoc(a.concept)],
      tier: tierOf(a.unit),
    });
  for (const x of b.examples)
    docs.push({
      id: `example:${x.id}`,
      type: "example",
      title: `${x.title}${x.bookLabel ? " (" + x.bookLabel + ")" : ""}`,
      body: x.summary,
      keywords: [x.bookLabel ?? "", "worked example"],
      ref: where(x.sources, x.unit),
      href: `/learn/${x.unit}#${x.id}`,
      related: x.concepts.map(conceptDoc),
      tier: tierOf(x.unit),
    });
  for (const n of b.notation)
    docs.push({
      id: `notation:${n.id}`,
      type: "notation",
      title: `Notation: ${n.meaning}`,
      body: n.note2018,
      keywords: ["notation", "symbol"],
      ref: n.sources.map(describeSource).join(" · "),
      href: `/revision/notation#${n.id}`,
      tier: "core",
    });
  // Concepts link to their equations, algorithms and examples, so a concept hit surfaces them as cross-references.
  for (const d of docs)
    if (d.type === "equation" || d.type === "algorithm" || d.type === "example")
      for (const r of d.related ?? []) {
        const c = byId.get(r);
        if (c && !c.related!.includes(d.id)) c.related!.push(d.id);
      }
  return docs;
}
