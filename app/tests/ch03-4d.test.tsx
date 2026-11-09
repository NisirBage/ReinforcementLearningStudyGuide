// @vitest-environment jsdom
// Milestone 4D: Chapter 3 completed to the coverage criteria. The 5 × 5 gridworld of Examples 3.8 and 3.12 (in the
// library and the DP laboratory), descriptive example cards, the rule that they cannot claim computed verification,
// and the Chapter 3 lessons, flags and coverage.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { preloadAll, renderApp } from "./helpers";
import { renderMarkdown, texHasError } from "../src/lib/render";
import { loadBundle, loadCoverageInputs } from "../../tools/content_loader.ts";
import { computeCoverage } from "../src/content/coverage";
import { validateBundle } from "../src/content/schema";
import { CHECKS } from "../src/content/checks";
import { GRID5, gridworld5x5 } from "../src/lib/rl/envs/examples";

beforeAll(preloadAll);
afterEach(cleanup);
const settled = async () => {
  const h = await screen.findByRole("heading", { level: 1 });
  await waitFor(() => expect(document.activeElement).toBe(h));
  return h;
};
const bundle = loadBundle();
const ctx = { checks: new Set(Object.keys(CHECKS)), implementations: new Set<string>() };

describe("the 5 × 5 gridworld (Examples 3.8 and 3.12)", () => {
  const g = gridworld5x5();
  const step = (s: number, a: number) => g.dynamics[s][a][0];
  test("A and B jump with their bonus whatever the action; the edge costs −1; nothing is terminal", () => {
    expect(g.states).toHaveLength(25);
    expect(g.terminal.every((t) => !t)).toBe(true);
    for (let a = 0; a < 4; a++) {
      expect(step(GRID5.A, a)).toEqual({ next: GRID5.A2, reward: 10, prob: 1 });
      expect(step(GRID5.B, a)).toEqual({ next: GRID5.B2, reward: 5, prob: 1 });
    }
    expect(step(0, 0)).toEqual({ next: 0, reward: -1, prob: 1 }); // up from the top-left corner
    expect(step(0, 3)).toEqual({ next: 0, reward: -1, prob: 1 }); // left from it
    expect(step(12, 1)).toEqual({ next: 17, reward: 0, prob: 1 }); // down from the centre
    expect(g.grid.marks).toEqual({ 1: "A", 3: "B", 21: "A′", 13: "B′" });
  });
});

describe("the dynamic programming laboratory on the 5 × 5 gridworld", () => {
  test("policy iteration starts from Figure 3.5b; value iteration reaches Figure 3.8", async () => {
    const user = userEvent.setup();
    renderApp("/lab/dp");
    await settled();
    await user.selectOptions(screen.getByLabelText(/^Problem/), "grid5");
    const grid = screen.getByRole("table", { name: "Values and greedy actions" });
    expect(within(grid).getByRole("cell", { name: /^row 1, column 2, A, value 8\.8/ })).toBeInTheDocument();
    expect(within(grid).getByRole("cell", { name: /^row 5, column 5, value -2\.0/ })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/^Method/), "vi");
    await user.click(screen.getByRole("button", { name: /To convergence/ }));
    const vgrid = screen.getByRole("table", { name: "Values and greedy actions" });
    expect(within(vgrid).getByRole("cell", { name: /^row 1, column 2, A, value 24\.4, best up or down or right or left$/ })).toBeInTheDocument();
    expect(within(vgrid).getByRole("cell", { name: /^row 2, column 4, value 17\.8, best left$/ })).toBeInTheDocument();
  });
});

describe("descriptive examples", () => {
  test("an example with no numerical claims says so and offers no checks to run", async () => {
    renderApp("/example/ex.ch03.bioreactor");
    await settled();
    expect(screen.getByText(/makes no numerical claim, so there is nothing for our code to reproduce/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Run the checks/ })).not.toBeInTheDocument();
  });

  test("an example with claims still lists them and runs its checks", async () => {
    const user = userEvent.setup();
    renderApp("/example/ex.ch03.solving-gridworld");
    await settled();
    await user.click(screen.getByRole("button", { name: "Run the checks in your browser" }));
    expect(await screen.findAllByText("✓")).toHaveLength(3);
  });

  test("a descriptive example cannot claim a computed verification", () => {
    const b = loadBundle();
    const i = b.examples.findIndex((x) => x.id === "ex.ch03.bioreactor");
    b.examples[i] = { ...b.examples[i], verification: { method: "computed", on: "2026-11-09", check: "ch03.fig3-5-values" } };
    expect(validateBundle(b, ctx).join("\n")).toMatch(/ex\.ch03\.bioreactor: an example with no facts cannot be verified by computation/);
  });
});

describe("Chapter 3 content", () => {
  const ch03 = (u: { unit: string }) => u.unit === "ch03";
  test("every section has a lesson whose maths renders, and the coverage report counts the chapter as covered", () => {
    const lesson = bundle.lessons.find(ch03)!;
    expect(lesson.sections.map((s) => s.section)).toEqual(["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9", "3.10"]);
    for (const s of lesson.sections) for (const l of s.layers) expect(texHasError(renderMarkdown(l.body)), `${s.id} ${l.layer}`).toBe(false);
    const { inventory, declarations } = loadCoverageInputs();
    const c = computeCoverage(bundle, inventory, declarations).find((x) => x.id === "3")!;
    expect(c.status).toBe("covered");
    expect(c.exercises.inBank).toHaveLength(20);
    expect(c.exercises.declared).toEqual({ "3.7": "placeholder" });
  });

  test("all twelve examples are items, and the figures' transcriptions are what the checks compare", () => {
    expect(bundle.examples.filter(ch03).map((x) => x.bookLabel)).toEqual(Array.from({ length: 12 }, (_, i) => `Example 3.${i + 1}`));
    const fig = bundle.figures.find((f) => f.id === "fig.ch03.gridworld-optimal-values")!;
    expect(fig.spec.kind === "value-grids" && fig.spec.grids[0].values[1]).toBe(24.4);
    expect((CHECKS["ch03.fig3-8-values"] as { run: () => boolean }).run()).toBe(true);
  });

  test("questionable source material is flagged, not corrected", () => {
    const eq = bundle.equations.find((e) => e.id === "eq.ch03.unified-return")!;
    expect(eq.flags![0].note).toMatch(/§11\.3, on R-learning and the average-reward setting/);
    const golf = bundle.examples.find((x) => x.id === "ex.ch03.golf")!;
    expect(golf.flags![0]).toMatchObject({ type: "suspected-typo", suggestion: "Read it as 'the value is lower' (more negative)." });
  });
});
