// @vitest-environment jsdom
// Milestone 4C: Chapter 2 completed to the coverage criteria. The random-walk testbed (Exercise 2.4), the parameter
// study (Figure 2.5), the line chart's gaps and category labels, the new lessons, equations and questions, and the
// coverage report for Chapter 2.
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { preloadAll, renderApp } from "./helpers";
import { renderMarkdown, texHasError } from "../src/lib/render";
import { loadBundle, loadCoverageInputs } from "../../tools/content_loader.ts";
import { computeCoverage } from "../src/content/coverage";
import { FIG_2_5, FIG_2_5_EXPONENTS, TESTBED_10, parameterStudy, recordRun, runExperiment, studyMethods, type Method } from "../src/lib/rl/banditLab";
import { LineChart } from "../src/components/LineChart";

beforeAll(preloadAll);
afterEach(cleanup);
const settled = async () => {
  const h = await screen.findByRole("heading", { level: 1 });
  await waitFor(() => expect(document.activeElement).toBe(h));
  return h;
};
const bundle = loadBundle();
const EG: Method = { kind: "epsilon-greedy", epsilon: 0.1, q1: 0, step: { kind: "sample-average" } };
const WALK = { ...TESTBED_10, sdOfMeans: 0, walkSd: 0.01 };

describe("the random-walk testbed (Exercise 2.4)", () => {
  test("without a walk the true values never move; with one they start equal and drift", () => {
    const still = recordRun(TESTBED_10, EG, 50, 4);
    expect(still.qs.every((q) => q.every((x, i) => x === still.q[i]))).toBe(true);
    const moving = recordRun(WALK, EG, 400, 4);
    expect(moving.qs[0]).toEqual(new Array(10).fill(0));
    expect(new Set(moving.qs[399]).size).toBe(10);
    // each step moves each value by a N(0, 0.01²) step: after 399 steps the spread is about 0.01·√399 ≈ 0.2
    const sd = Math.sqrt(moving.qs[399].reduce((s, x) => s + x * x, 0) / 10);
    expect(sd).toBeGreaterThan(0.05);
    expect(sd).toBeLessThan(0.6);
  });

  test("every method faces the same walk in a run, and 'optimal' means best at that step", () => {
    const a = recordRun(WALK, EG, 200, 9, 3, 0);
    const b = recordRun(WALK, { kind: "ucb", c: 2, q1: 0, step: { kind: "sample-average" } }, 200, 9, 3, 1);
    expect(a.qs).toEqual(b.qs);
    for (const [i, d] of a.details.entries()) expect(d.optimal).toBe(a.qs[i][d.action] === Math.max(...a.qs[i]));
  });

  test("the fast runner sees the walk too: a stationary-only shortcut would change the curves", () => {
    const [still] = runExperiment({ ...WALK, walkSd: 0 }, [EG], 20, 300, 5);
    const [moving] = runExperiment(WALK, [EG], 20, 300, 5);
    expect(Array.from(moving.avgReward)).not.toEqual(Array.from(still.avgReward));
  });
});

describe("the parameter study (Figure 2.5)", () => {
  test("the families and ranges read from the figure", () => {
    const pow = (f: (typeof FIG_2_5)[number]) => [f.exponents[0], f.exponents.at(-1)];
    expect(FIG_2_5.map((f) => f.key)).toEqual(["epsilon-greedy", "gradient", "ucb", "optimistic"]);
    expect(FIG_2_5.map(pow)).toEqual([[-7, -2], [-5, 2], [-4, 2], [-2, 2]]);
    expect(FIG_2_5_EXPONENTS).toEqual([-7, -6, -5, -4, -3, -2, -1, 0, 1, 2]);
    expect(studyMethods(FIG_2_5)).toHaveLength(6 + 8 + 7 + 5);
    expect(FIG_2_5[3].make(0.5)).toEqual({ kind: "epsilon-greedy", epsilon: 0, q1: 0.5, step: { kind: "constant", alpha: 0.1 } });
  });

  test("each point is the mean of the learning curve over all steps", () => {
    const fam = [FIG_2_5[0]];
    const res = parameterStudy(TESTBED_10, fam, 5, 50, 3);
    const curves = runExperiment(TESTBED_10, studyMethods(fam), 5, 50, 3);
    res[0].forEach((v, j) => expect(v).toBeCloseTo(curves[j].avgReward.reduce((s, x) => s + x, 0) / 50, 12));
  });
});

describe("the line chart", () => {
  test("a non-finite value breaks the line, and category labels name the x positions", () => {
    render(<LineChart title="Gaps" series={[{ label: "a", values: [1, 2, NaN, 3, 4] }, { label: "b", values: [NaN, 1, 1, 1, NaN] }]} xLabel="p" yLabel="y" format={(v) => v.toFixed(1)} xLabels={["1/4", "1/2", "1", "2", "4"]} />);
    const paths = Array.from(document.querySelectorAll("path.line")).map((p) => p.getAttribute("d")!);
    expect(paths[0].match(/M/g)).toHaveLength(2);
    expect(paths[0]).not.toMatch(/NaN/);
    expect(paths[1].match(/M/g)).toHaveLength(1);
    const table = screen.getByRole("table");
    const heads = within(table).getAllByRole("rowheader").map((c) => c.textContent);
    expect(heads).toEqual(["1/4", "1/2", "1", "2", "4"]);
    expect(within(table).getAllByRole("row")[1].textContent).toContain("–");
    // "a" reaches the last x and is labelled in the right margin; "b" stops early and is labelled beside its last point
    const labels = Array.from(document.querySelectorAll("text.end-label"));
    const xOf = (s: string) => Number(labels.find((l) => l.textContent === s)!.getAttribute("x"));
    expect(xOf("b")).toBeLessThan(xOf("a") - 100);
  });
});

describe("the bandit laboratory", () => {
  test("the Exercise 2.4 preset sets a random walk and 10,000-step runs, and says the walk size is our choice", async () => {
    const user = userEvent.setup();
    renderApp("/lab/bandit");
    await settled();
    await user.selectOptions(screen.getByLabelText(/^Preset/), "ex24");
    expect(screen.getByText(/The draft does not give the size of the walk; 0\.01 is our choice/)).toBeInTheDocument();
    expect(screen.getByLabelText("Random walk per step")).toHaveDisplayValue("0.01");
    const exp = screen.getByRole("heading", { name: "Average many runs" }).closest("section")!;
    expect(within(exp).getByLabelText("Steps")).toHaveDisplayValue("10000");
    await user.click(screen.getByRole("button", { name: "Step" }));
    expect(screen.getByText(/the true values q\(a\) shown are those at step 1; they move after every step/)).toBeInTheDocument();
  });

  test("the parameter study draws Figure 2.5 and tabulates each method's best setting beside the draft's", async () => {
    const user = userEvent.setup();
    renderApp("/lab/bandit");
    await settled();
    const study = screen.getByRole("heading", { name: "Parameter study (Figure 2.5)" }).closest("section")!;
    const runs = within(study).getByLabelText("Runs of the parameter study");
    await user.clear(runs);
    await user.type(runs, "3");
    await user.click(within(study).getByRole("button", { name: "Run the study" }));
    expect(await within(study).findByText("Average reward over the first 1000 steps (3 runs)", {}, { timeout: 15_000 })).toBeInTheDocument();
    const best = within(study).getByRole("table", { name: "Best setting of each method" });
    const rows = within(best).getAllByRole("row").slice(1);
    expect(rows.map((r) => r.querySelector("td")!.textContent!.trim())).toEqual(["ε-greedy", "gradient bandit", "UCB", "optimistic greedy"]);
    expect(rows[2]).toHaveTextContent("c = 1/2 and 1, about 1.47");
    expect(within(study).getAllByText("1/128").length).toBeGreaterThan(0);
  });
});

describe("Chapter 2 content", () => {
  const ch02 = (u: { unit: string }) => u.unit === "ch02";
  test("every written section has a lesson, and the lessons render without KaTeX errors", () => {
    const lesson = bundle.lessons.find(ch02)!;
    expect(lesson.sections.map((s) => s.section)).toEqual(["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9"]);
    for (const s of lesson.sections) for (const l of s.layers) expect(texHasError(renderMarkdown(l.body)), `${s.id} ${l.layer}`).toBe(false);
  });

  test("the coverage report counts Chapter 2 as covered, with every exercise accounted for", () => {
    const { inventory, declarations } = loadCoverageInputs();
    const c = computeCoverage(bundle, inventory, declarations).find((x) => x.id === "2")!;
    expect(c.status).toBe("covered");
    expect(c.sections.every((s) => s.status === "covered")).toBe(true);
    expect(c.exercises.inBank).toEqual(["2.1", "2.2", "2.3", "2.5", "2.6"]);
    expect(c.exercises.declared).toEqual({ "2.4": "lab-task" });
    expect(c.exercises.missing).toEqual([]);
  });

  test("exercises are labelled as the draft's, and new questions are not", () => {
    const qs = bundle.questionFiles.find(ch02)!.questions;
    const ex = qs.filter((q) => q.provenance.kind === "textbook-exercise");
    expect(ex.map((q) => (q.provenance as { exercise: string }).exercise).sort()).toEqual(["2.1", "2.2", "2.3", "2.5", "2.6"]);
    for (const q of ex) expect(q.sources.every((s) => s.kind === "textbook" && s.printedPages[0] >= 51)).toBe(true);
    expect(qs.find((q) => q.id === "ch02-q046")!.provenance).toEqual({ kind: "textbook-derived", basis: ["Exercise 2.4", "§2.4"] });
  });

  test("questionable source material is flagged, not corrected", () => {
    const eq = bundle.equations.find((e) => e.id === "eq.ch02.exact-gradient-ascent")!;
    expect(eq.bookLabel).toBe("(2.11)");
    expect(eq.flags![0]).toMatchObject({ type: "suspected-typo" });
    expect(eq.flags![0].suggestion).toContain(String.raw`\mathbb{E}[R_t \mid A_t] = q(A_t)`);
    const opt = bundle.concepts.find((c) => c.id === "ch02.optimistic-initial-values")!;
    expect(opt.flags![0].note).toMatch(/Figure 2\.5 labels the same parameter \$Q_0\$/);
    const s27 = bundle.lessons.find(ch02)!.sections.find((s) => s.section === "2.7")!;
    expect(s27.layers.find((l) => l.layer === "connections")!.body).toMatch(/Chapter 11 \(Policy Approximation\)/);
  });
});
