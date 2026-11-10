// The validator accepts the real content and rejects each kind of broken content it is meant to catch.
import { describe, expect, test } from "vitest";
import { loadBundle } from "../../tools/content_loader.ts";
import { pdfPageOf, romanToInt, sectionPages, validateBundle, type ContentBundle } from "../src/content/schema";
import { checkIds } from "../src/content/checks";
import { implementationIds } from "../src/lib/rl/registry";

const ctx = { checks: checkIds(), implementations: implementationIds() };
const real = loadBundle();
const clone = (): ContentBundle => structuredClone(real);
/** Validate a mutated copy and return its errors. */
const errorsAfter = (mutate: (b: ContentBundle) => void): string[] => {
  const b = clone();
  mutate(b);
  return validateBundle(b, ctx);
};
const q = (b: ContentBundle, id: string) => b.questionFiles.flatMap((f) => f.questions).find((x) => x.id === id)!;

describe("real content", () => {
  test("validates with no errors", () => {
    expect(validateBundle(real, ctx)).toEqual([]);
  });

  test("has the representative items this milestone promised", () => {
    expect(real.concepts.length).toBeGreaterThanOrEqual(15);
    expect(real.equations.map((e) => e.bookLabel)).toEqual(expect.arrayContaining(["(2.1)", "(2.3)", "(2.6)", "(2.8)", "(3.12)", "(4.5)"]));
    expect(real.algorithms.map((a) => a.bookLabel)).toContain("Figure 4.1");
    expect(real.examples.map((x) => x.bookLabel)).toContain("Example 4.1, Figure 4.2");
    expect(real.questionFiles.flatMap((f) => f.questions).length).toBeGreaterThanOrEqual(10);
  });

  test("the registry mirrors the book: 15 chapters, PDF = printed + 14, Zhao file offsets", () => {
    expect(real.sources.sb.chapters.map((c) => c.id)).toEqual(Array.from({ length: 15 }, (_, i) => String(i + 1)));
    expect(pdfPageOf(real.sources, "sb", "2", 37)).toBe(51);
    expect(pdfPageOf(real.sources, "zhao", "6", 104)).toBe(4);
    expect(sectionPages(real.sources, "sb", "2.3")).toEqual([36, 38]);
    expect(sectionPages(real.sources, "sb", "4.1")).toEqual([90, 94]);
    expect(real.curriculum.core.filter((u) => u.status === "empty-in-draft").map((u) => u.chapter)).toEqual(["10", "12", "13"]);
  });

  test("every core item cites only the 2015 textbook, every supplementary item only supplementary sources", () => {
    const items = [...real.concepts, ...real.equations, ...real.algorithms, ...real.examples, ...real.questionFiles.flatMap((f) => f.questions)];
    for (const it of items) {
      const kinds = it.sources.map((s) => s.kind);
      if (it.unit.startsWith("sup-")) expect(kinds.every((k) => k !== "textbook" && k !== "textbook-matter")).toBe(true);
      else expect(kinds.every((k) => k === "textbook" || k === "textbook-matter")).toBe(true);
    }
  });

  test("romanToInt", () => {
    expect([romanToInt("xiii"), romanToInt("xiv"), romanToInt("viii"), romanToInt("ix"), romanToInt("12")]).toEqual([13, 14, 8, 9, null]);
  });
});

describe("validator rejects", () => {
  const expectError = (pattern: RegExp, mutate: (b: ContentBundle) => void) => {
    const errs = errorsAfter(mutate);
    expect(errs.some((e) => pattern.test(e)), `expected an error matching ${pattern}, got:\n${errs.join("\n")}`).toBe(true);
  };

  test("a PDF page that does not match the printed page", () =>
    expectError(/pdfPages 52–52 do not match printed 37–37/, (b) => {
      b.equations.find((e) => e.bookLabel === "(2.3)")!.sources[0] = { kind: "textbook", chapter: "2", section: "2.3", printedPages: [37, 37], pdfPages: [52, 52] };
    }));

  test("printed pages outside the cited section", () =>
    expectError(/outside §2\.3/, (b) => {
      b.concepts.find((c) => c.id === "ch02.incremental-update")!.sources[0] = { kind: "textbook", chapter: "2", section: "2.3", printedPages: [40, 40], pdfPages: [54, 54] };
    }));

  test("an unknown section", () =>
    expectError(/unknown textbook section 2\.9\.9/, (b) => {
      b.concepts[0].sources[0] = { kind: "textbook", chapter: "2", section: "2.9.9", printedPages: [33, 33], pdfPages: [47, 47] };
    }));

  test("a wrong Zhao PDF page", () =>
    expectError(/expected 4–4/, (b) => {
      b.equations.find((e) => e.unit === "sup-zhao-06")!.sources[0] = { kind: "zhao", chapter: "6", section: "6.2", printedPages: [104, 104], pdfPages: [104, 104] };
    }));

  test("a core item citing a supplementary source", () =>
    expectError(/core items may cite only the April 2015 textbook/, (b) => {
      b.concepts.find((c) => c.id === "ch02.step-size-conditions")!.sources.push({ kind: "lecture", lecture: "L6", slides: [25, 27] });
    }));

  test("a supplementary item citing the textbook as its source", () =>
    expectError(/supplementary items must not cite the textbook/, (b) => {
      b.concepts.find((c) => c.unit === "sup-zhao-06")!.sources.push({ kind: "textbook", chapter: "2", section: "2.4", printedPages: [39, 39], pdfPages: [53, 53] });
    }));

  test("a core concept depending on a supplementary one (merging into the core syllabus)", () =>
    expectError(/core concept lists supplementary prerequisite/, (b) => {
      b.concepts.find((c) => c.id === "ch02.step-size-conditions")!.prereqs.push("sup-zhao-06.robbins-monro");
    }));

  test("a core question tagged with a supplementary concept", () =>
    expectError(/other side of the core\/supplementary line/, (b) => {
      q(b, "ch02-q005").concepts.push("sup-zhao-06.robbins-monro");
    }));

  test("a textbook equation not verified against the page image", () =>
    expectError(/must be verified against the page image/, (b) => {
      b.equations.find((e) => e.bookLabel === "(2.8)")!.verification = { method: "text-layer", on: "2026-11-04" };
    }));

  test("a numeric question without a computed check", () =>
    expectError(/numeric answers must be verified by a computed check/, (b) => {
      delete q(b, "ch02-q002").verification;
    }));

  test("a check id that does not exist", () =>
    expectError(/must name an existing check/, (b) => {
      q(b, "ch02-q002").verification = { method: "computed", on: "2026-11-04", check: "no-such-check" };
    }));

  test("an algorithm pointing at code that does not exist", () =>
    expectError(/not in lib\/rl\/registry\.ts/, (b) => {
      b.algorithms[0].implementation = "dp.valueIterationThatDoesNotExist";
    }));

  test("a prerequisite cycle", () =>
    expectError(/prerequisite cycle/, (b) => {
      b.concepts.find((c) => c.id === "ch02.action-value-estimate")!.prereqs.push("ch02.ucb");
    }));

  test("a 2018 cross-reference without the unverified flag", () =>
    expectError(/notation-unverified/, (b) => {
      delete b.equations.find((e) => e.bookLabel === "(2.1)")!.flags;
    }));

  test("an mcq answer that is not an option", () =>
    expectError(/multi answer must be distinct option indices/, (b) => {
      q(b, "ch02-q005").answer = [0, 9];
    }));

  test("a duplicate question id", () =>
    expectError(/duplicate id ch02-q001/, (b) => {
      b.questionFiles.find((f) => f.unit === "ch02")!.questions[1].id = "ch02-q001"; // by unit: ch01 sorts first since Milestone 4H
    }));

  test("a curriculum that drops a textbook chapter", () =>
    expectError(/omits textbook chapter 9/, (b) => {
      b.curriculum.core = b.curriculum.core.filter((u) => u.chapter !== "9");
    }));

  test("a lesson layer referring to an unknown item", () =>
    expectError(/refers to unknown item/, (b) => {
      b.lessons[0].sections[0].layers[1].refs = ["eq.ch02.missing"];
    }));

  test("an unknown flag type", () =>
    expectError(/flags\[0\] needs a known type/, (b) => {
      b.examples[0].flags = [{ type: "silently-fixed" as never, note: "x" }];
    }));
});
