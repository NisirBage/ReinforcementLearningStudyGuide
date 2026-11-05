// Formats a source reference for display. Kept apart from searchDocs.ts so the app shell does not carry the search code.
import type { SourceRef } from "./schema";

export const span = (a: number | string, b: number | string) => (a === b ? `p. ${a}` : `pp. ${a}–${b}`);
export const pdfSpan = ([a, b]: [number, number]) => (a === b ? `PDF ${a}` : `PDF ${a}–${b}`);

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
