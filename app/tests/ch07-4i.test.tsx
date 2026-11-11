// @vitest-environment jsdom
// Milestone 4I: Chapter 7 completed to the coverage criteria. n-step returns, the λ-return, TD(λ) with the three traces,
// true on-line TD(λ), Sarsa(λ) and Watkins's Q(λ); the eligibility-traces laboratory and its explainer demos; and the
// Chapter 7 lessons, flags and coverage.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { preloadAll, renderApp } from "./helpers";
import { renderMarkdown, texHasError } from "../src/lib/render";
import { loadBundle, loadCoverageInputs } from "../../tools/content_loader.ts";
import { computeCoverage } from "../src/content/coverage";
import * as tr from "../src/lib/rl/traces";

beforeAll(preloadAll);
afterEach(cleanup);
const settled = async () => {
  const h = await screen.findByRole("heading", { level: 1 });
  await waitFor(() => expect(document.activeElement).toBe(h));
  return h;
};
const bundle = loadBundle();
const walk: tr.Walk = { states: [10, 11, 12, 11, 12, 13], rewards: [0, 0, 0, 0, 2] }; // a made-up walk with a revisit

describe("returns", () => {
  test("n-step returns truncate at the horizon and become the complete return past the end", () => {
    const V = Array.from({ length: 21 }, (_, s) => s / 10);
    expect(tr.nStepReturn(walk, 0, 1, V, 0.5)).toBeCloseTo(0 + 0.5 * 1.1, 12);
    expect(tr.nStepReturn(walk, 0, 2, V, 0.5)).toBeCloseTo(0.25 * 1.2, 12);
    expect(tr.nStepReturn(walk, 0, 99, V, 0.5)).toBeCloseTo(2 * 0.5 ** 4, 12);
  });

  test("the λ-return is the weighted average of n-step returns, with the tail on the complete return (7.6)", () => {
    const V = Array.from({ length: 21 }, (_, s) => Math.sin(s));
    for (const lambda of [0, 0.3, 0.9, 1])
      for (let t = 0; t < 5; t++) {
        const T = 5;
        let direct = lambda ** (T - t - 1) * tr.nStepReturn(walk, t, 99, V, 0.9);
        for (let n = 1; n <= T - t - 1; n++) direct += (1 - lambda) * lambda ** (n - 1) * tr.nStepReturn(walk, t, n, V, 0.9);
        expect(tr.lambdaReturn(walk, t, lambda, V, 0.9)).toBeCloseTo(direct, 12);
      }
  });

  test("the half-life of λ (Exercise 7.4)", () => {
    expect(tr.halfLife(0.5)).toBeCloseTo(1, 12);
    expect(0.9 ** tr.halfLife(0.9)).toBeCloseTo(0.5, 12);
  });
});

describe("traces", () => {
  test("off-line TD(λ) with accumulating traces equals the off-line λ-return algorithm, revisits included", () => {
    const A = new Array(21).fill(0.3);
    const B = [...A];
    tr.lambdaReturnEpisode(A, walk, 0.7, 0.2, 0.9, "offline");
    tr.tdLambdaEpisode(B, walk, 0.7, 0.2, 0.9, "accumulating", { mode: "offline" });
    A.forEach((x, i) => expect(B[i]).toBeCloseTo(x, 12));
  });

  test("Sarsa(λ) and Watkins's Q(λ) share the trace update; Watkins cuts after a nongreedy next action", () => {
    const g = tr.openGrid(2, 3, [0, 2]);
    const zero = () => g.states.map(() => g.actions.map(() => 0));
    const Q = zero();
    const E = zero();
    Q[1][2] = 1; // at state 1 the greedy action is "right"
    const r1 = tr.traceControlUpdate(Q, E, g, "watkins", "replacing", { s: 0, a: 2, r: 0, s2: 1, a2: 0 }, 0.5, 1, 0.9); // next action "up" is not greedy
    expect(r1.cut).toBe(true);
    expect(E.flat().every((x) => x === 0)).toBe(true);
    expect(r1.delta).toBeCloseTo(1, 12); // the target uses the max
    const r2 = tr.traceControlUpdate(Q, E, g, "sarsa", "replacing", { s: 0, a: 2, r: 0, s2: 1, a2: 0 }, 0.5, 1, 0.9);
    expect(r2.cut).toBe(false);
    expect(E[0][2]).toBeCloseTo(0.9, 12);
  });
});

describe("the eligibility-traces laboratory", () => {
  test("is listed in the lab hub", async () => {
    renderApp("/lab");
    await settled();
    expect(screen.getByRole("link", { name: /Eligibility-traces laboratory/ })).toBeInTheDocument();
  });

  test("TD(λ) steps show the TD error and traces; the experiment panel runs; Example 7.2 credits the whole path", async () => {
    const user = userEvent.setup();
    renderApp("/lab/traces");
    await settled();
    const step = screen.getByRole("heading", { name: /TD\(λ\) step by step/ }).closest("section")!;
    await user.click(within(step).getByRole("button", { name: "Step" }));
    expect(within(step).getByText(/δ = /)).toBeInTheDocument();
    expect(within(step).getByRole("table", { name: /Values and eligibility traces/ })).toBeInTheDocument();

    const exp = screen.getByRole("heading", { name: /19-state random walk/ }).closest("section")!;
    const runs = within(exp).getByLabelText("number of runs");
    await user.clear(runs);
    await user.type(runs, "2");
    await user.click(within(exp).getByRole("button", { name: "Run" }));
    expect(await within(exp).findByText(/Best setting: n = /, {}, { timeout: 20_000 })).toBeInTheDocument();

    const credit = screen.getByRole("heading", { name: /Credit from one episode/ }).closest("section")!;
    expect(within(credit).getByText(/20 action values raised with traces, against 1/)).toBeInTheDocument();
    await user.selectOptions(within(credit).getByLabelText(/Exploratory move/), "14");
    expect(within(credit).getByText(/6 action values raised with traces, against 1/)).toBeInTheDocument();
  });

  test("the TD(λ) algorithm page embeds the new demo", async () => {
    renderApp("/algorithm/alg.ch07.td-lambda");
    await settled();
    expect(screen.getByRole("heading", { name: /TD\(λ\) step by step/ })).toBeInTheDocument();
  });
});

describe("Chapter 7 content", () => {
  const ch07 = (u: { unit: string }) => u.unit === "ch07";
  test("every section has a lesson whose maths renders, the equations render, and the chapter is covered", () => {
    const lesson = bundle.lessons.find(ch07)!;
    expect(lesson.sections.map((s) => s.section)).toEqual(["7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "7.9", "7.10"]);
    for (const s of lesson.sections) for (const l of s.layers) expect(texHasError(renderMarkdown(l.body)), `${s.id} ${l.layer}`).toBe(false);
    for (const e of bundle.equations.filter(ch07)) expect(texHasError(renderMarkdown(`$$${e.tex}$$`)), e.id).toBe(false);
    const { inventory, declarations } = loadCoverageInputs();
    const c = computeCoverage(bundle, inventory, declarations).find((x) => x.id === "7")!;
    expect(c.status).toBe("covered");
    expect(c.exercises.missing).toEqual([]);
  });

  test("questionable source material is flagged, not corrected", () => {
    const eq = bundle.equations.find((e) => e.id === "eq.ch07.n-step-target")!;
    expect(eq.tex).toContain("\\gamma^2 + \\cdots"); // kept as printed
    expect(eq.flags![0].note).toMatch(/R_\{t\+3\}\$ is missing/);
    const flags = (id: string) => bundle.concepts.find((c) => c.id === id)!.flags!.map((f) => f.note).join(" ");
    expect(flags("ch07.forward-backward-equivalence")).toMatch(/upper-left panel/);
    expect(flags("ch07.lambda-return")).toMatch(/\$L_t\$/);
    expect(flags("ch07.random-walk-19")).toMatch(/lower part of Figure 7\.2/);
  });
});
