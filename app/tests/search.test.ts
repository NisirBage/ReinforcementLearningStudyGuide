import { describe, expect, test } from "vitest";
import { loadBundle } from "../../tools/content_loader.ts";
import { buildSearchDocs, describeSource } from "../src/content/searchDocs";
import { buildIndex, search, stem, tokenize, withinOneEdit, type SearchHit } from "../src/domain/search";

const docs = buildSearchDocs(loadBundle());
const index = buildIndex(docs);
const ids = (hits: SearchHit[]) => hits.map((h) => h.doc.id);
const rank = (q: string, id: string) => ids(search(index, q)).indexOf(id);

describe("text processing", () => {
  test("tokenize lower-cases, drops stop words, stems plurals and -ing", () => {
    expect(tokenize("The Values of States")).toEqual(["value", "state"]);
    expect(tokenize("Q-learning")).toEqual(["q", "learn"]);
    expect(stem("policies")).toBe("policy");
    expect(stem("class")).toBe("class");
  });
  test("one-edit matching", () => {
    expect(withinOneEdit("incremental", "incremantal")).toBe(true);
    expect(withinOneEdit("bellman", "belman")).toBe(true);
    expect(withinOneEdit("bellman", "bellmann")).toBe(true);
    expect(withinOneEdit("policy", "polity")).toBe(true);
    expect(withinOneEdit("policy", "pricing")).toBe(false);
  });
  test("duplicate ids are refused", () => {
    expect(() => buildIndex([docs[0], docs[0]])).toThrow(/duplicate/);
  });
});

describe("search over the real content", () => {
  test("every textbook-derived result shows chapter/section, printed page and PDF page", () => {
    const eq = docs.find((d) => d.id === "equation:eq.ch02.incremental-update")!;
    expect(eq.ref).toBe("S&B 2015 §2.3 · p. 37 (PDF 51)");
    const sec = docs.find((d) => d.id === "sb:4.1")!;
    expect(sec.ref).toBe("S&B 2015 §4.1 · pp. 90–94 (PDF 104–108)");
  });

  test("'incremental' finds §2.3 material first", () => {
    const top = ids(search(index, "incremental")).slice(0, 3);
    expect(top).toEqual(expect.arrayContaining(["concept:ch02.incremental-update", "equation:eq.ch02.incremental-update"]));
  });

  test("abbreviations expand: 'UCB' finds upper-confidence-bound selection", () => {
    expect(rank("UCB", "concept:ch02.ucb")).toBeLessThan(3);
    expect(rank("UCB", "equation:eq.ch02.ucb")).toBeLessThan(3);
  });

  test("typos are tolerated", () => {
    expect(rank("incremantal update", "concept:ch02.incremental-update")).toBeGreaterThanOrEqual(0);
    expect(rank("belman equation", "equation:eq.ch03.bellman-v")).toBeLessThan(5);
  });

  test("search as you type: a prefix matches", () => {
    expect(rank("recency weigh", "concept:ch02.recency-weighted-average")).toBe(0);
  });

  test("'Bellman equation' surfaces related material through cross-references", () => {
    const hits = search(index, "Bellman equation");
    const got = ids(hits);
    expect(got.slice(0, 3)).toEqual(expect.arrayContaining(["equation:eq.ch03.bellman-v", "concept:ch03.bellman-equation-v"]));
    for (const related of ["concept:ch03.state-value-function", "concept:ch04.policy-evaluation"]) expect(got).toContain(related);
  });

  test("'policy evaluation' reaches the algorithm box and the worked example", () => {
    const got = ids(search(index, "policy evaluation"));
    expect(got).toContain("algorithm:alg.ch04.iterative-policy-evaluation");
    expect(got).toContain("example:ex.ch04.gridworld-4x4");
    expect(got).toContain("sb:4.1");
  });

  test("supplementary material is found but always labelled", () => {
    const hit = search(index, "robbins monro").find((h) => h.doc.id === "concept:sup-zhao-06.robbins-monro")!;
    expect(hit.doc.tier).toBe("supplementary");
    expect(hit.doc.ref).toMatch(/^Supplementary · Zhao §6\.2 · pp\. 103–104 \(Ch 6 PDF 3–4\) · Lecture 6 · slides 15–19$/);
  });

  test("empty draft sections are searchable and say so", () => {
    const hit = search(index, "monte carlo tree search").find((h) => h.doc.id === "sb:8.8")!;
    expect(hit.doc.body).toMatch(/Heading only/);
  });

  test("notation entries show the 2015 page and the 2018 cross-reference text", () => {
    const hit = search(index, "behavior policy").find((h) => h.doc.id === "notation:mu-behaviour")!;
    expect(hit.doc.body).toMatch(/writes the behavior policy as b/);
  });

  test("an empty or stop-word-only query returns nothing", () => {
    expect(search(index, "")).toEqual([]);
    expect(search(index, "the of and")).toEqual([]);
  });

  test("describeSource formats every kind", () => {
    expect(describeSource({ kind: "lecture", lecture: "L7", slides: [10, 10] })).toBe("Lecture 7 · slide 10");
    expect(describeSource({ kind: "paper", citation: "van Hasselt (2010)" })).toBe("Paper · van Hasselt (2010)");
    expect(describeSource({ kind: "textbook-matter", matter: "Summary of Notation", printedPages: ["xiii", "xiv"], pdfPages: [13, 14] })).toBe(
      "S&B 2015 Summary of Notation · pp. xiii–xiv (PDF 13–14)",
    );
  });
});
