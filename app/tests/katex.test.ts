// Every piece of maths in content/ renders with KaTeX without a parse error.
import { describe, expect, test } from "vitest";
import { loadBundle } from "../../tools/content_loader.ts";
import { renderMarkdown, renderTex, texHasError } from "../src/lib/render";

const b = loadBundle();

/** Every TeX string stored as TeX, with where it came from. */
const texFields: [string, string][] = [
  ...b.equations.flatMap((e) => [
    [`${e.id} tex`, e.tex] as [string, string],
    ...(e.notation2018 ? [[`${e.id} notation2018`, e.notation2018.tex] as [string, string]] : []),
    ...e.symbols.map((s, i) => [`${e.id} symbol ${i}`, s.tex] as [string, string]),
    ...(e.derivation ?? []).map((s, i) => [`${e.id} step ${i + 1}`, s.tex] as [string, string]),
  ]),
  ...b.notation.flatMap((n) => [[`notation ${n.id}`, n.tex] as [string, string], ...(n.tex2018 ? [[`notation ${n.id} 2018`, n.tex2018] as [string, string]] : [])]),
];

/** Every Markdown field that may contain $…$ maths. */
const mdFields: [string, string][] = [
  ...b.equations.flatMap((e) => (e.example ? [[`${e.id} example`, e.example] as [string, string]] : [])),
  ...b.algorithms.flatMap((a) => [...a.lines.map((l, i) => [`${a.id} line ${i}`, l.text] as [string, string]), ...a.inputs.map((x) => [`${a.id} input`, x] as [string, string]), [`${a.id} output`, a.output] as [string, string]]),
  ...b.lessons.flatMap((l) => l.sections.flatMap((s) => s.layers.map((ly) => [`${s.id} ${ly.layer}`, ly.body] as [string, string]))),
  ...b.questionFiles.flatMap((f) =>
    f.questions.flatMap((q) => [
      [`${q.id} stem`, q.stem] as [string, string],
      ...q.solution.map((s, i) => [`${q.id} solution ${i}`, s] as [string, string]),
      [`${q.id} explanation`, q.explanation] as [string, string],
      ...(q.options ?? []).map((o, i) => [`${q.id} option ${i}`, o] as [string, string]),
    ]),
  ),
];

describe("TeX fields", () => {
  test(`there are TeX fields to check (${texFields.length})`, () => expect(texFields.length).toBeGreaterThan(60));
  for (const [where, tex] of texFields)
    test(where, () => {
      const html = renderTex(tex, true);
      expect(texHasError(html), `${where}: ${tex}`).toBe(false);
      expect(html).toContain('class="katex"');
    });
});

describe("Markdown fields with maths", () => {
  for (const [where, text] of mdFields.filter(([, t]) => t.includes("$")))
    test(where, () => {
      const html = renderMarkdown(text);
      expect(texHasError(html), where).toBe(false);
      expect(html).toContain("katex");
      expect(html).not.toMatch(/\$[^$]*\\[a-z]+/); // no raw TeX left between dollar signs
    });
});

describe("renderer behaviour", () => {
  test("broken TeX is reported, not thrown", () => {
    expect(texHasError(renderTex("\\frac{1}{"))).toBe(true);
  });
  test("raw HTML in content is escaped, never rendered", () => {
    expect(renderMarkdown("<script>alert(1)</script> and <b>x</b>")).not.toMatch(/<script>|<b>/);
  });
  test("an escaped dollar sign stays literal", () => {
    expect(renderMarkdown("costs \\$5")).toContain("$5");
  });
  test("maths inside `code` is left alone", () => {
    expect(renderMarkdown("`$x$`")).toContain("<code>$x$</code>");
  });
});
