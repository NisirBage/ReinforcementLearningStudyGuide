// @vitest-environment jsdom
// Milestone 4A: the source inventory, the coverage computation and its declarations, the content quality checks,
// the build-time search index, reading progress and section bookmarks, and the coverage badges.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { catalog, loadUnit } from "virtual:rl-content";
import searchDocs from "virtual:rl-search";
import { loadBundle, loadCoverageInputs } from "../../tools/content_loader.ts";
import { computeCoverage, validateDeclarations, type CoverageDeclarations } from "../src/content/coverage";
import { qualityChecks } from "../src/content/quality";
import { buildSearchDocs } from "../src/content/searchDocs";
import { checkIds } from "../src/content/checks";
import { fetchSearchIndex, resetContentCache, setUnitLoaderForTests } from "../src/content/load";
import { emptyProgress, setSectionRead, toggleSectionBookmark } from "../src/domain/progress";
import { STORAGE_KEY, encodeSaved, exportProgress, mergeProgress, migrate, parseImport } from "../src/store/persistence";
import { memoryStore } from "../src/store/idb";
import { stripLocal } from "../plugins/vite_content.ts";
import { preloadAll, renderApp } from "./helpers";
import type { ContentBundle } from "../src/content/schema";

const fresh = () => loadBundle();
const { inventory, declarations } = loadCoverageInputs();
const settled = async () => {
  const h = await screen.findByRole("heading", { level: 1 });
  await waitFor(() => expect(document.activeElement).toBe(h));
  return h;
};
afterEach(cleanup);

describe("source inventory", () => {
  const parts = inventory.chapters.flatMap((c) => [c.intro, ...c.sections]);
  test("records every numbered equation, named example and figure caption of the draft once", () => {
    expect(parts.flatMap((s) => s.equations)).toHaveLength(80);
    expect(parts.flatMap((s) => s.examples)).toHaveLength(36);
    expect(parts.flatMap((s) => s.figures)).toHaveLength(104);
    for (const k of ["equations", "examples", "figures"] as const) {
      const all = parts.flatMap((s) => s[k]);
      expect(new Set(all).size, k).toBe(all.length);
    }
  });

  test("numbers run without gaps through each chapter (nothing missed between sections)", () => {
    for (const c of inventory.chapters)
      for (const k of ["equations", "examples", "figures"] as const) {
        const ns = [c.intro, ...c.sections].flatMap((s) => s[k]).map((x) => Number(x.split(".")[1]));
        expect(ns, `chapter ${c.id} ${k}`).toEqual(ns.map((_, i) => i + 1));
      }
  });

  test("has every section of the registry, and places the labels the audit checked by hand", () => {
    const b = fresh();
    expect(inventory.chapters.map((c) => c.sections.map((s) => s.id))).toEqual(b.sources.sb.chapters.map((c) => c.sections.map((s) => s.id)));
    const at = (id: string) => inventory.chapters.flatMap((c) => c.sections).find((s) => s.id === id)!;
    expect(inventory.chapters.find((c) => c.id === "4")!.intro.equations).toEqual(["4.1", "4.2"]); // before §4.1
    expect(at("3.8").equations).toEqual(["3.13", "3.14", "3.15", "3.16", "3.17"]);
    expect(at("4.1").examples).toEqual(["4.1"]); // headed without a colon in the draft
    expect(at("6.3").examples).toEqual(["6.3", "6.4"]);
    expect(at("9.1").equations).toEqual(["9.1"]); // the draft's RMSE
  });

  test("holds numbers only, never the book's text", () => {
    const strings = JSON.stringify(inventory.chapters).match(/"[^"]*"/g)!;
    expect(strings.every((s) => /^"(\d+(\.\d+)?|id|intro|words|equations|examples|figures|sections)"$/.test(s))).toBe(true);
  });
});

describe("coverage", () => {
  const cov = computeCoverage(fresh(), inventory, declarations);
  const sec = (id: string) => cov.flatMap((c) => c.sections).find((s) => s.id === id)!;

  test("unwritten chapters and heading-only sections are reported as such, with nothing missing", () => {
    for (const ch of ["10", "12", "13"]) expect(cov.find((c) => c.id === ch)!.status).toBe("unwritten");
    for (const s of ["8.8", "15.2", "15.3", "15.4"]) expect(sec(s)).toMatchObject({ status: "unwritten", missing: [] });
  });

  test("a section is covered only with a lesson, its equations, its examples and a question", () => {
    expect(sec("2.3").status).toBe("covered");
    // A partial section, made on a fresh copy so the test does not depend on how far Milestone 4 has got (it used
    // §4.2, then §5.3): without its lesson, §2.3 is partial and the lesson is the only thing missing.
    const noLesson = fresh();
    noLesson.lessons = noLesson.lessons.map((l) => ({ ...l, sections: l.sections.filter((s) => s.section !== "2.3") }));
    const s23 = computeCoverage(noLesson, inventory, declarations).flatMap((c) => c.sections).find((s) => s.id === "2.3")!;
    expect(s23).toMatchObject({ status: "partial", missing: ["no lesson"] });
    expect(sec("7.1")).toMatchObject({ status: "not-started" });
    // Chapter 4's opening equations are covered now; removing (4.1) shows that a missing one is still reported.
    expect(cov.find((c) => c.id === "4")!.intro.missing).toEqual([]);
    const without41 = fresh();
    without41.equations = without41.equations.filter((e) => e.bookLabel !== "(4.1)");
    expect(computeCoverage(without41, inventory, declarations).find((c) => c.id === "4")!.intro.missing).toEqual(["introduction: equation (4.1) missing"]);
  });

  test("removing a section's questions makes it partial; declarations alone never make a section covered", () => {
    const b = fresh();
    b.questionFiles = b.questionFiles.map((f) => ({ ...f, questions: f.questions.filter((q) => q.section !== "2.3") }));
    expect(computeCoverage(b, inventory, declarations).flatMap((c) => c.sections).find((s) => s.id === "2.3")!.missing).toEqual(["no questions"]);
    const loud: CoverageDeclarations = { ...declarations, sections: { ...declarations.sections, "7.1": { treatment: "reading-guide", note: "x" } } };
    expect(computeCoverage(fresh(), inventory, loud).flatMap((c) => c.sections).find((s) => s.id === "7.1")!.status).toBe("not-started");
  });

  test("examples reproduced by a lab check count, and exercises declared as placeholders are accounted for", () => {
    expect(sec("4.4").examples).toEqual({ expected: ["4.3"], asItems: [], byLabCheck: ["4.3"] });
    expect(cov.find((c) => c.id === "3")!.exercises.declared).toEqual({ "3.7": "placeholder" });
  });

  test("the declarations are checked", () => {
    const b = fresh();
    expect(validateDeclarations(declarations, b, inventory, checkIds())).toEqual([]);
    const bad: CoverageDeclarations = {
      sections: { "2.99": { treatment: "full", note: "x" } },
      examples: { "4.9": { check: "nope" } },
      exercises: { "2.1": { disposition: "placeholder", note: "x" }, "4.1": { disposition: "lab-task", lab: "dp", note: "x" }, "4.9": { disposition: "lab-task", lab: "nolab", note: "x" } },
    };
    const errs = validateDeclarations(bad, b, inventory, checkIds()).join("\n");
    expect(errs).toMatch(/unknown section 2\.99/);
    expect(errs).toMatch(/Example 4\.9 is not in the inventory/);
    expect(errs).toMatch(/4\.9: needs an existing check/);
    expect(errs).toMatch(/2\.1: only exercises the registry marks as placeholders/);
    expect(errs).toMatch(/4\.1: already a bank question/);
    expect(errs).toMatch(/4\.9: a lab task must name an existing lab/);
  });
});

describe("content quality checks", () => {
  test("the real content passes", () => {
    expect(qualityChecks(fresh(), inventory).errors).toEqual([]);
  });

  const withLesson = (body: string, refs?: string[]): ContentBundle => {
    const b = fresh();
    b.lessons[0].sections[0].layers[0] = { ...b.lessons[0].sections[0].layers[0], body, ...(refs ? { refs } : {}) };
    return b;
  };
  const errorsOf = (b: ContentBundle) => qualityChecks(b, inventory).errors.join("\n");

  test("links inside text must resolve to the app's own pages", () => {
    expect(errorsOf(withLesson("See [the concept](#/concept/ch02.ucb) and [§2.4](#/learn/ch02/2.4) and [practice](#/practice?concept=ch02.ucb)."))).toBe("");
    expect(errorsOf(withLesson("See [x](#/concept/ch02.nope)."))).toMatch(/unknown concept ch02\.nope/);
    expect(errorsOf(withLesson("See [x](#/equation/alg.ch06.sarsa)."))).toMatch(/unknown equation alg\.ch06\.sarsa/);
    expect(errorsOf(withLesson("See [x](#/learn/ch02/3.1)."))).toMatch(/§3\.1 is not a section of ch02/);
    expect(errorsOf(withLesson("See [x](https://example.org)."))).toMatch(/external links are not allowed/);
  });

  test("control characters, unparsable TeX and dollar amounts are caught", () => {
    expect(errorsOf(withLesson("A JSON escape: $\tfrac12$"))).toMatch(/control character U\+0009/);
    expect(errorsOf(withLesson("Broken $\\frac{1}{$ maths"))).toMatch(/KaTeX cannot parse/);
    expect(errorsOf(withLesson("Win \\$50 or \\$100 with $p = 0.4$."))).toBe(""); // escaped dollars are fine
    const b = fresh();
    b.equations[0] = { ...b.equations[0], tex: "\\frac{1}{" };
    expect(errorsOf(b)).toMatch(/KaTeX cannot parse "\\frac\{1\}\{"/);
  });

  test("identical question stems are errors, near-identical ones warnings", () => {
    const b = fresh();
    const qs = b.questionFiles[0].questions;
    qs.push({ ...qs[0], id: "ch02-q900" });
    expect(errorsOf(b)).toMatch(/ch02-q900: same stem as ch02-q001/);
    const c = fresh();
    const q = c.questionFiles[0].questions;
    const long = q.find((x) => x.stem.split(" ").length > 20)!;
    q.push({ ...long, id: "ch02-q901", stem: long.stem.replace(/\.$/, " exactly.") });
    expect(qualityChecks(c, inventory).warnings.join("\n")).toMatch(new RegExp(`${long.id} and ch02-q901 are near duplicates`));
  });

  test("equation and example labels must exist in the draft, in the section the item cites", () => {
    const b = fresh();
    const i = b.equations.findIndex((e) => e.bookLabel === "(2.3)");
    b.equations[i] = { ...b.equations[i], bookLabel: "(2.99)" };
    expect(errorsOf(b)).toMatch(/the draft has no numbered equation \(2\.99\)/);
    const c = fresh();
    const j = c.equations.findIndex((e) => e.bookLabel === "(4.10)");
    c.equations[j] = { ...c.equations[j], bookLabel: "(4.6)" };
    expect(errorsOf(c)).toMatch(/\(4\.6\) is in §4\.2, but the item cites §4\.4/);
    const d = fresh();
    d.examples[0] = { ...d.examples[0], bookLabel: "Example 4.7" };
    expect(errorsOf(d)).toMatch(/the draft has no Example 4\.7/);
  });

  test("warnings: equations nothing uses, and lessons leaning on items outside their prerequisites", () => {
    // Until Milestone 4C, (2.1) was unused; the §2.2 lesson now shows it, so the real content raises no warning.
    expect(qualityChecks(fresh(), inventory).warnings).toEqual([]);
    const unused = fresh();
    unused.lessons = unused.lessons.map((l) => ({ ...l, sections: l.sections.map((s) => ({ ...s, layers: s.layers.map((ly) => ({ ...ly, refs: ly.refs?.filter((r) => r !== "eq.ch02.sample-average") })) })) }));
    expect(qualityChecks(unused, inventory).warnings).toEqual(["equation eq.ch02.sample-average: not used by any lesson, question or explainer"]);
    const w = qualityChecks(withLesson("Text.", ["alg.ch06.q-learning"]), inventory).warnings.join("\n");
    expect(w).toMatch(/alg\.ch06\.q-learning belongs to ch06\.q-learning, outside the section's concepts/);
  });
});

describe("build-time search index", () => {
  test("is exactly the documents built from the full content", () => {
    expect(searchDocs).toEqual(stripLocal(buildSearchDocs(fresh())));
  });

  test("the first search loads no chapter content", async () => {
    resetContentCache();
    const seen: string[] = [];
    setUnitLoaderForTests((u) => (seen.push(u), loadUnit(u)));
    await fetchSearchIndex();
    expect(seen).toEqual([]);
    setUnitLoaderForTests();
    resetContentCache();
  });

  test("the catalogue carries the coverage status of every textbook section", () => {
    expect(Object.keys(catalog.coverage.sections)).toHaveLength(90);
    expect(catalog.coverage.chapters["10"]).toBe("unwritten");
  });
});

describe("reading progress and section bookmarks", () => {
  test("marks and bookmarks survive export, import and merge; malformed keys are dropped", () => {
    let p = setSectionRead(emptyProgress(), "ch02/2.3", true, 1000);
    p = toggleSectionBookmark(p, "ch06/6.5");
    const back = parseImport(exportProgress(p, 2000));
    expect(back.sectionsRead).toEqual({ "ch02/2.3": 1000 });
    expect(back.sectionBookmarks).toEqual(["ch06/6.5"]);
    const other = setSectionRead(emptyProgress(), "ch02/2.3", true, 3000);
    expect(mergeProgress(back, other).sectionsRead).toEqual({ "ch02/2.3": 3000 });
    expect(setSectionRead(p, "ch02/2.3", false, 4000).sectionsRead).toEqual({});
    const m = migrate({ ...p, sectionsRead: { "ch02/2.3": 5, "../etc": 1, "ch02/2.4": "x" }, sectionBookmarks: ["ch06/6.5", 7, "bad key"] });
    expect(m.sectionsRead).toEqual({ "ch02/2.3": 5 });
    expect(m.sectionBookmarks).toEqual(["ch06/6.5"]);
  });

  test("a save from before Milestone 4A loads with no reading marks", () => {
    const { sectionsRead: _r, sectionBookmarks: _b, ...old } = emptyProgress();
    expect(migrate(old)).toMatchObject({ sectionsRead: {}, sectionBookmarks: [] });
  });
});

describe("in the interface", () => {
  beforeAll(preloadAll);

  test("a section can be marked read and bookmarked, and the chapter and Progress pages show it", async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    renderApp("/learn/ch02/2.3", store);
    await settled();
    expect(screen.getAllByText("Covered").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Mark as read" }));
    expect(screen.getByRole("button", { name: "✓ Read" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "☆ Bookmark" }));
    expect(screen.getByRole("button", { name: "★ Bookmarked" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(Object.values(store.dump()).join("")).toContain('"ch02/2.3"'));
    cleanup();
    renderApp("/learn/ch02", store);
    await settled();
    const row = screen.getByRole("link", { name: /2\.3 Incremental Implementation/ }).closest("li")!;
    await waitFor(() => expect(within(row).getByText("✓ read")).toBeInTheDocument());
    expect(within(row).getByText("★")).toBeInTheDocument();
    cleanup();
    renderApp("/progress", store);
    await settled();
    const reading = await screen.findByRole("region", { name: "Reading" });
    await waitFor(() => expect(within(reading).getByText(/1 of 9 sections read/)).toBeInTheDocument());
    expect(within(reading).getByRole("link", { name: /§2\.3 Incremental Implementation/ })).toHaveAttribute("href", "/learn/ch02/2.3");
  });

  test("the chapter list shows each chapter's coverage honestly", async () => {
    renderApp("/learn", memoryStore({ [STORAGE_KEY]: encodeSaved(emptyProgress(), 1) }));
    await settled();
    const row = (ch: string) => screen.getAllByRole("link").find((a) => a.querySelector(".num")?.textContent === ch)!;
    expect(row("10")).toHaveTextContent("Unwritten in draft");
    expect(row("2")).toHaveTextContent("Covered"); // completed in Milestone 4C
    expect(row("3")).toHaveTextContent("Covered"); // completed in Milestone 4D
    expect(row("4")).toHaveTextContent("Covered"); // completed in Milestone 4E
    expect(row("5")).toHaveTextContent("Covered"); // completed in Milestone 4F
    expect(row("6")).toHaveTextContent("Partial");
    expect(row("7")).toHaveTextContent("Not started");
  });
});
