// Markdown + KaTeX rendering for lesson bodies, captions, question stems and solutions (from the NLP Study Lab).
// Math ($…$ inline, $$…$$ display) is cut out before Markdown parsing and pasted back as KaTeX HTML, so Markdown
// never mangles TeX. Raw HTML in content is NOT rendered (html: false); only KaTeX's own output is inserted.
import katex from "katex";
import MarkdownIt from "markdown-it";

// "replacements" is off: it turns (c) and P(c) into ©.
const md = new MarkdownIt({ html: false, linkify: false, typographer: true }).disable("replacements");

const MATH = /\$\$([\s\S]+?)\$\$|\$((?:\\\$|[^$\n])+?)\$/g;
const INLINE_CODE = /`[^`\n]+`/g;

export function renderTex(tex: string, display = false): string {
  return katex.renderToString(tex.trim(), { displayMode: display, throwOnError: false, strict: "ignore", output: "htmlAndMathml" });
}

/** True when KaTeX could not parse the TeX (it then renders an error span instead of throwing). */
export const texHasError = (html: string): boolean => html.includes("katex-error");

export function renderMarkdown(src: string): string {
  const math: string[] = [];
  const mathOnly = (s: string) =>
    s.replace(/\\\$/g, "@@DOLLAR@@").replace(MATH, (_m, display: string | undefined, inline: string | undefined) => {
      math.push(display !== undefined ? renderTex(display, true) : renderTex(inline!, false));
      return `@@MATH${math.length - 1}@@`;
    });
  let out = "";
  let at = 0;
  for (const m of src.matchAll(INLINE_CODE)) {
    out += mathOnly(src.slice(at, m.index)) + m[0]; // dollars inside `code` are literal
    at = m.index! + m[0].length;
  }
  out += mathOnly(src.slice(at));
  return md
    .render(out)
    .replace(/@@MATH(\d+)@@/g, (_m, i: string) => math[Number(i)])
    .replace(/@@DOLLAR@@/g, "$");
}

/** Inline variant (no wrapping <p>) for short strings such as options and table cells. */
export function renderInline(src: string): string {
  const html = renderMarkdown(src).trim();
  const m = /^<p>([\s\S]*)<\/p>$/.exec(html);
  return m && !m[1].includes("<p>") ? m[1] : html;
}

/** Plain-text fields (symbol meanings, assumptions) may contain Unicode maths but no $…$; render them inline. */
export const renderText = (s: string): string => renderInline(s);
