// @vitest-environment jsdom
// Milestone 4K: Chapter 9 completed to the coverage criteria. Linear gradient-descent prediction and its special cases,
// the TD(λ) fixed point and the bound (9.9), coarse and tile coding, radial basis functions, mountain car with linear
// Sarsa(λ) and Q(λ); the function-approximation laboratory and its demos; and the Chapter 9 lessons, flags and coverage.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { preloadAll, renderApp } from "./helpers";
import { renderMarkdown, texHasError } from "../src/lib/render";
import { loadBundle, loadCoverageInputs } from "../../tools/content_loader.ts";
import { computeCoverage } from "../src/content/coverage";
import { makeRng } from "../src/domain/random";
import * as A from "../src/lib/rl/approx";

beforeAll(preloadAll);
afterEach(cleanup);
const settled = async () => {
  const h = await screen.findByRole("heading", { level: 1 });
  await waitFor(() => expect(document.activeElement).toBe(h));
  return h;
};
const bundle = loadBundle();

describe("features and linear prediction", () => {
  test("aggregation features have exactly one 1 per nonterminal state; the tabular case is the group size 1", () => {
    const f = A.aggregationFeatures(19, 4);
    for (let s = 1; s <= 19; s++) expect(f(s).reduce((a, b) => a + b, 0)).toBe(1);
    expect(f(5)).toEqual([0, 1, 0, 0, 0]);
    expect(A.aggregationFeatures(19, 1)(7)).toEqual(A.tabularFeatures(20)(6).slice(0, 19));
  });

  test("a linear gradient step moves each weight in proportion to its feature", () => {
    const w = [1, 2];
    A.gradientStep(w, [1, 0.5], 3, 0.1);
    expect(w[0]).toBeCloseTo(1.1, 12);
    expect(w[1]).toBeCloseTo(2.05, 12);
  });

  test("tile coding: one feature per tiling is present, and every tile index is in range", () => {
    const coder = A.tileCoder(10, 9, makeRng(1));
    for (const [x, y] of [[0, 0], [0.999, 0.999], [0.5, 0.25]]) {
      const act = coder.active(x, y);
      expect(act).toHaveLength(10);
      expect(new Set(act).size).toBe(10);
      for (const i of act) expect(i >= 0 && i < coder.size).toBe(true);
    }
  });

  test("the TD fixed point equals the minimum-error weights at λ = 1 and with tabular features at any λ", () => {
    const c = A.reflectingWalk(10, 0.9);
    const d = A.stationary(c.P);
    expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    const agg = Array.from({ length: 10 }, (_, s) => A.aggregationFeatures(10, 2)(s + 1));
    const best = A.bestWeights(c, agg, d);
    A.tdFixedPoint(c, agg, d, 1).forEach((x, i) => expect(x).toBeCloseTo(best[i], 9));
    const tab = Array.from({ length: 10 }, (_, s) => A.tabularFeatures(10)(s));
    expect(A.rmse(c, tab, A.tdFixedPoint(c, tab, d, 0), d)).toBeCloseTo(0, 9); // a table can represent v exactly
  });
});

describe("mountain car", () => {
  test("the dynamics follow the draft: bounds, velocity reset at the left, termination on the right", () => {
    const left = A.mcStep({ p: -1.19, v: -0.07 }, -1);
    expect(left.s).toEqual({ p: -1.2, v: 0 });
    expect(A.mcStep({ p: 0.49, v: 0.07 }, 1).done).toBe(true);
    const mid = A.mcStep({ p: -0.5, v: 0 }, 1);
    expect(mid.s.v).toBeCloseTo(0.001 - 0.0025 * Math.cos(-1.5), 12);
  });
});

describe("the function-approximation laboratory", () => {
  test("is listed in the lab hub", async () => {
    renderApp("/lab");
    await settled();
    expect(screen.getByRole("link", { name: /Function-approximation laboratory/ })).toBeInTheDocument();
  });

  test("linear TD(λ) runs episodes; the bound table and mountain car work", async () => {
    const user = userEvent.setup();
    renderApp("/lab/approximation");
    await settled();
    const ltd = screen.getByRole("heading", { name: /Linear TD\(λ\) with state aggregation/ }).closest("section")!;
    await user.click(within(ltd).getByRole("button", { name: "+100 episodes" }));
    expect(within(ltd).getByRole("status")).toHaveTextContent(/^100 episodes; RMS error over the 19 states 0\.\d{3}\.$/);
    const bound = screen.getByRole("table", { name: /RMSE of the TD\(λ\) fixed point/ });
    expect(within(bound).getAllByRole("row")).toHaveLength(7);
    const mc = screen.getByRole("heading", { name: /Mountain car/ }).closest("section")!;
    await user.click(within(mc).getByRole("button", { name: "+1 episode" }));
    expect(await within(mc).findByText(/^1 episodes; the last took \d+ steps\.$/, {}, { timeout: 20_000 })).toBeInTheDocument();
    expect(within(mc).getByRole("table", { name: /Cost-to-go/ })).toBeInTheDocument();
  });

  test("the Figure 9.1 algorithm page embeds the linear TD demo", async () => {
    renderApp("/algorithm/alg.ch09.gradient-td-lambda");
    await settled();
    expect(screen.getByRole("heading", { name: /Linear TD\(λ\) with state aggregation/ })).toBeInTheDocument();
  });
});

describe("Chapter 9 content", () => {
  const ch09 = (u: { unit: string }) => u.unit === "ch09";
  test("every section has a lesson whose maths renders, the equations render, and the chapter is covered", () => {
    const lesson = bundle.lessons.find(ch09)!;
    expect(lesson.sections.map((s) => s.section)).toEqual(["9.1", "9.2", "9.3", "9.4", "9.5", "9.6"]);
    for (const s of lesson.sections) for (const l of s.layers) expect(texHasError(renderMarkdown(l.body)), `${s.id} ${l.layer}`).toBe(false);
    for (const e of bundle.equations.filter(ch09)) expect(texHasError(renderMarkdown(`$$${e.tex}$$`)), e.id).toBe(false);
    const { inventory, declarations } = loadCoverageInputs();
    const c = computeCoverage(bundle, inventory, declarations).find((x) => x.id === "9")!;
    expect(c.status).toBe("covered");
    expect(c.exercises.missing).toEqual([]);
  });

  test("questionable source material is flagged, not corrected", () => {
    const flags = (id: string) => bundle.concepts.find((c) => c.id === id)!.flags!.map((f) => f.note).join(" ");
    expect(flags("ch09.approx-control")).toMatch(/G_\{t\+1\}/);
    expect(flags("ch09.linear-sarsa-lambda")).toMatch(/Section 7\.8/);
    expect(flags("ch09.td-bound")).toMatch(/Section 9\.2/);
    expect(flags("ch09.state-aggregation")).toMatch(/Exercise 8\.4/);
  });
});
