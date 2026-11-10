// @vitest-environment jsdom
// Milestone 4G: Chapter 6 completed to the coverage criteria. Batch updating and the certainty-equivalence estimate
// (Examples 6.3–6.4), the windy gridworld variants of Exercises 6.6–6.7 in the TD laboratory, and the Chapter 6
// lessons, flags and coverage.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { preloadAll, renderApp } from "./helpers";
import { renderMarkdown, texHasError } from "../src/lib/render";
import { loadBundle, loadCoverageInputs } from "../../tools/content_loader.ts";
import { computeCoverage } from "../src/content/coverage";
import { batchUpdate, certaintyEquivalence, sampleAverageReturns, type Episode } from "../src/lib/rl/batch";
import { windyGridworld, windyVariant } from "../src/lib/rl/envs/examples";
import { valueIteration } from "../src/lib/rl/dp";

beforeAll(preloadAll);
afterEach(cleanup);
const settled = async () => {
  const h = await screen.findByRole("heading", { level: 1 });
  await waitFor(() => expect(document.activeElement).toBe(h));
  return h;
};
const bundle = loadBundle();
const step = (s: number, r: number, next: number) => ({ t: 0, s, a: 0, r, next });

describe("batch updating", () => {
  // Example 6.4: A = 0, B = 1, terminal = 2
  const terminal = [false, false, true];
  const eps: Episode[] = [[step(0, 0, 1), step(1, 0, 2)], ...Array.from({ length: 6 }, () => [step(1, 1, 2)]), [step(1, 0, 2)]];

  test("batch TD(0) reaches the certainty-equivalence estimate and batch MC the sample averages, for any small α", () => {
    for (const alpha of [0.01, 0.05]) {
      const td = batchUpdate(eps, terminal, "td", alpha, 1, [0, 0, 0]).V;
      const mc = batchUpdate(eps, terminal, "mc", alpha, 1, [0, 0, 0]).V;
      expect(td[0]).toBeCloseTo(0.75, 6);
      expect(td[1]).toBeCloseTo(0.75, 6);
      expect(mc[0]).toBeCloseTo(0, 6);
      expect(mc[1]).toBeCloseTo(0.75, 6);
    }
    expect(certaintyEquivalence(eps, terminal, 1).slice(0, 2)).toEqual([0.75, 0.75]);
    expect(sampleAverageReturns(eps, 3, 1).slice(0, 2)).toEqual([0, 0.75]);
  });

  test("states never visited in the batch have no estimate", () => {
    const ce = certaintyEquivalence([[step(1, 1, 2)]], terminal, 1);
    expect(Number.isNaN(ce[0])).toBe(true);
    expect(ce[1]).toBe(1);
  });
});

describe("the windy gridworld variants (Exercises 6.6–6.7)", () => {
  const optimum = (m: ReturnType<typeof windyGridworld>) => -valueIteration(m, 1, { theta: 1e-12 }).v[m.grid.start];
  test("king's moves need 7 steps, 'stay' does not help, and stochastic wind costs about 10.96 expected steps", () => {
    expect(optimum(windyGridworld())).toBeCloseTo(15, 9);
    expect(optimum(windyVariant())).toBeCloseTo(7, 9);
    expect(optimum(windyVariant({ stay: true }))).toBeCloseTo(7, 9);
    expect(optimum(windyVariant({ stochastic: true }))).toBeCloseTo(10.9646, 4);
  });

  test("king's moves add four diagonal actions; stochastic wind only varies in windy columns", () => {
    const m = windyVariant({ stochastic: true });
    expect(m.actions).toHaveLength(8);
    expect(windyVariant({ stay: true }).actions).toHaveLength(9);
    const start = m.grid.start; // column 0 is calm: every move from S is deterministic
    for (const outs of m.dynamics[start]) expect(outs).toHaveLength(1);
  });

  test("the TD laboratory's comparison panel runs the stochastic-wind variant and prints its optimum", async () => {
    const user = userEvent.setup();
    renderApp("/lab/td");
    await settled();
    const select = screen.getByRole("option", { name: /stochastic wind \(Exercise 6\.7\)/ }).closest("select")!;
    const panel = select.closest("section")!;
    await user.selectOptions(select, "king-stochastic");
    const runs = within(panel).getByLabelText("number of runs");
    await user.clear(runs);
    await user.type(runs, "2");
    await user.click(within(panel).getByRole("button", { name: "Run" }));
    expect(await within(panel).findByText(/Optimal expected episode length from S .*: 10\.96 steps/, {}, { timeout: 20_000 })).toBeInTheDocument();
  });
});

describe("Chapter 6 content", () => {
  const ch06 = (u: { unit: string }) => u.unit === "ch06";
  test("every section has a lesson whose maths renders, and the chapter is covered with every exercise in the bank", () => {
    const lesson = bundle.lessons.find(ch06)!;
    expect(lesson.sections.map((s) => s.section)).toEqual(["6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7"]);
    for (const s of lesson.sections) for (const l of s.layers) expect(texHasError(renderMarkdown(l.body)), `${s.id} ${l.layer}`).toBe(false);
    for (const e of bundle.equations.filter(ch06)) expect(texHasError(renderMarkdown(`$$${e.tex}$$`)), e.id).toBe(false);
    const { inventory, declarations } = loadCoverageInputs();
    const c = computeCoverage(bundle, inventory, declarations).find((x) => x.id === "6")!;
    expect(c.status).toBe("covered");
    expect(c.exercises.declared).toEqual({});
    expect(c.exercises.missing).toEqual([]);
  });

  test("questionable source material is flagged, not corrected", () => {
    const concept = (id: string) => bundle.concepts.find((c) => c.id === id)!;
    expect(concept("ch06.afterstates").flags![0].note).toMatch(/Example 11\.1/);
    expect(concept("ch06.q-learning").flags![0].note).toMatch(/Actor–critic methods and R-learning are not in this chapter/);
    expect(concept("ch06.td-prediction").flags![0].note).toMatch(/Section 15\.2/);
  });
});
