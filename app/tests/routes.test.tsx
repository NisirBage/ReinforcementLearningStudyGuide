// @vitest-environment jsdom
// Every route renders a real page: every static page, every chapter and module, every section, every item.
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { idx } from "../src/content/bundle";
import { NAV } from "../src/components/Layout";
import { renderApp } from "./helpers";

afterEach(cleanup);

async function expectPage(path: string, heading?: RegExp | string) {
  renderApp(path);
  const h1 = await screen.findByRole("heading", { level: 1 });
  expect(h1.textContent, path).not.toMatch(/Page not found/);
  if (heading) expect(h1.textContent).toMatch(heading);
  return h1;
}

describe("static routes", () => {
  const routes: [string, RegExp][] = [
    ["/", /2015 draft/],
    ["/learn", /Learn/],
    ["/search", /Search/],
    ["/search?q=bellman", /Search/],
    ["/revision", /Revise/],
    ["/revision/review", /Spaced review/],
    ["/revision/equations", /Equation library/],
    ["/revision/algorithms", /Algorithms/],
    ["/revision/notation", /Notation/],
    ["/revision/marked", /Marked questions/],
    ["/progress", /Progress/],
    ["/settings", /Settings/],
  ];
  for (const [path, h] of routes) test(path, () => expectPage(path, h));

  test("every main-navigation link points at a route that renders", async () => {
    for (const [to] of NAV) {
      await expectPage(to);
      cleanup();
    }
  });

  test("an unknown path shows the not-found page", async () => {
    renderApp("/no/such/page");
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Page not found");
  });
});

describe("every chapter and module", () => {
  for (const u of idx.units)
    test(u.id, async () => {
      await expectPage(`/learn/${u.id}`, u.title);
      if (u.kind === "supplementary") expect(screen.getAllByText(/Supplementary\./).length).toBeGreaterThan(0);
      if (u.status === "empty-in-draft") expect(screen.getByText(/title page only in the April 2015 draft/i)).toBeInTheDocument();
    });
});

describe("every section", () => {
  const all = idx.units.flatMap((u) => idx.sectionsOf(u.id).map((s) => [u.id, s.section.id, s.section.title] as const));
  test(`covers all ${all.length} sections of the textbook and the supplementary Zhao chapters`, () => {
    expect(all.filter(([u]) => u.startsWith("ch")).length).toBe(90);
  });
  for (const [unit, id, title] of all)
    test(`${unit} §${id}`, async () => {
      const h1 = await expectPage(`/learn/${unit}/${id}`);
      expect(h1.textContent).toContain(title);
      // The section's printed pages and PDF pages are shown under the heading.
      expect(screen.getAllByText(/pp?\. \d+(–\d+)? \(((Chapter|Appendix) \w+ )?PDF \d+/).length).toBeGreaterThan(0);
    });
  test("an unknown section is not found", async () => {
    renderApp("/learn/ch02/2.99");
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Page not found");
  });
});

describe("every concept and item page", () => {
  const b = idx.bundle;
  const pages = [
    ...b.concepts.map((c) => [`/concept/${c.id}`, c.title] as const),
    ...b.equations.map((e) => [`/equation/${e.id}`, e.name] as const),
    ...b.algorithms.map((a) => [`/algorithm/${a.id}`, a.name] as const),
    ...b.examples.map((x) => [`/example/${x.id}`, x.title] as const),
    ...b.figures.map((f) => [`/figure/${f.id}`, f.title] as const),
  ];
  for (const [path, title] of pages) test(path, () => expectPage(path, title));
});
