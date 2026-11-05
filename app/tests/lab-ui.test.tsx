// @vitest-environment jsdom
// Milestone 3D laboratories in the UI: the hub, the bandit step inspector and experiment, the MDP explorer's checks
// and values, and the Bellman laboratory's term table and iteration. Numbers are compared with the draft.
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { preloadAll, renderApp } from "./helpers";
import { renderMarkdown, texHasError } from "../src/lib/render";
import { loadBundle } from "../../tools/content_loader.ts";

beforeAll(preloadAll);
afterEach(cleanup);
const ready = () => screen.findByRole("heading", { level: 1 });
/** The page has loaded and moved focus to its heading (PageTitle), so typing into a field is not interrupted. */
const settled = async () => {
  const h = await ready();
  await waitFor(() => expect(document.activeElement).toBe(h));
  return h;
};
/** Clicks that navigate run inside an awaited act() (see tests/exam-ui.test.tsx, D-037). */
const go = (el: HTMLElement) => act(async () => void fireEvent.click(el));

describe("lab content", () => {
  test("every lab's text renders its maths without KaTeX errors", () => {
    for (const l of loadBundle().labs) for (const t of [l.summary, ...l.guide]) expect(texHasError(renderMarkdown(t)), `${l.id}: ${t}`).toBe(false);
  });
});

describe("the lab hub", () => {
  test("Lab is in the navigation and lists the three laboratories", async () => {
    renderApp("/");
    await ready();
    await go(screen.getByRole("link", { name: "Lab" }));
    expect(await ready()).toHaveTextContent("Interactive Lab");
    for (const t of ["Multi-armed bandit laboratory", "MDP explorer", "Bellman equation laboratory"]) expect(screen.getByRole("link", { name: new RegExp(t) })).toBeInTheDocument();
  });
});

describe("bandit laboratory", () => {
  test("stepping shows every number of the update; the draft's (2.9) typo is flagged on the page", async () => {
    const user = userEvent.setup();
    renderApp("/lab/bandit");
    expect(await ready()).toHaveTextContent("Multi-armed bandit laboratory");
    expect(screen.getByText(/unmatched parenthesis/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Step" }));
    const calc = document.querySelector("pre.calc")!;
    expect(calc.textContent).toMatch(/^t = 1/);
    expect(calc.textContent).toMatch(/greedy: A_t = an arm with the largest Q_t/);
    expect(calc.textContent).toMatch(/Q\(\d+\) ← Q \+ step·\(R − Q\) = 0\.000 \+ 1\/N = 1\/1·/);
    expect(screen.getByText(/Step 1 of 1000/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+10 steps" }));
    expect(screen.getByText(/Step 11 of 1000/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "← Back" }));
    expect(screen.getByText(/Step 10 of 1000/)).toBeInTheDocument();
  });

  test("UCB (Figure 2.3 preset) tries all ten arms first", async () => {
    const user = userEvent.setup();
    renderApp("/lab/bandit");
    await ready();
    await user.selectOptions(screen.getByLabelText(/^Preset/), "fig23");
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      await user.click(screen.getByRole("button", { name: "Step" }));
      const text = document.querySelector("pre.calc")!.textContent!;
      expect(text).toMatch(/untried: N = 0 counts as maximizing/);
      seen.add(/= (\d+) \(untried/.exec(text)![1]);
    }
    expect(seen.size).toBe(10);
  });

  test("an experiment runs in blocks and shows the two curves, a table view and the summary", async () => {
    const user = userEvent.setup();
    renderApp("/lab/bandit");
    await settled();
    const exp = screen.getByRole("heading", { name: "Average many runs" }).closest("section")!;
    const runs = within(exp).getByLabelText("Runs");
    await user.clear(runs);
    await user.type(runs, "60");
    const steps = within(exp).getByLabelText("Steps");
    await user.clear(steps);
    await user.type(steps, "100");
    await user.click(within(exp).getByRole("button", { name: "Run" }));
    expect(await within(exp).findByText("Average reward (60 runs)", {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(within(exp).getByText("% optimal action")).toBeInTheDocument();
    expect(within(exp).getByText(/best possible ≈ 1\.539/)).toBeInTheDocument();
    expect(within(exp).getAllByText("Show as a table")).toHaveLength(2);
    const summary = within(exp).getByRole("table", { name: "Over the last 10% of steps" });
    expect(within(summary).getAllByRole("row")).toHaveLength(4); // header + three methods
  });
});

describe("MDP explorer", () => {
  test("the recycling robot is evaluated exactly and iteratively, with (3.7) and (3.8) shown", async () => {
    renderApp("/lab/mdp");
    expect(await ready()).toHaveTextContent("MDP explorer");
    const values = screen.getByRole("table", { name: /exactly and by iterative policy evaluation/ });
    const rows = within(values).getAllByRole("row").slice(1).map((r) => Array.from(r.querySelectorAll("td")).map((c) => c.textContent));
    expect(rows.map((r) => r[0])).toEqual(["high", "low"]);
    for (const r of rows) expect(Math.abs(Number(r[1]) - Number(r[2]))).toBeLessThan(1e-4);
    expect(screen.getByRole("table", { name: /expected reward/ })).toHaveTextContent("search");
    expect(screen.getByRole("img", { name: /^Transitions: each state/ })).toBeInTheDocument();
  });

  test("a probability that breaks a row's sum stops the computation and says where", async () => {
    const user = userEvent.setup();
    renderApp("/lab/mdp");
    await settled();
    const p = screen.getByLabelText("Probability of outcome 1 for search");
    await user.clear(p);
    await user.type(p, "0.5");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Not computed");
    expect(alert).toHaveTextContent("p(·, · | high, search): the probabilities sum to 0.6, not 1.");
  });

  test("with γ = 1 the recycling robot has no v_π; the gridworld gives the values of Figure 4.2", async () => {
    const user = userEvent.setup();
    renderApp("/lab/mdp");
    await settled();
    const g = screen.getByLabelText("Discount γ");
    await user.clear(g);
    await user.type(g, "1");
    expect(await screen.findByRole("alert")).toHaveTextContent("does not exist here");
    await user.selectOptions(screen.getByLabelText(/^Preset/), "gridworld");
    const grid = await screen.findByLabelText("v_π on the grid");
    expect(Array.from(grid.querySelectorAll("span")).map((s) => s.textContent)).toEqual(["0.0", "-14.0", "-20.0", "-22.0", "-14.0", "-18.0", "-20.0", "-20.0", "-20.0", "-20.0", "-18.0", "-14.0", "-22.0", "-20.0", "-14.0", "0.0"]);
  });
});

describe("Bellman laboratory", () => {
  test("the Exercise 3.9 preset gives 0 + 0.675; γ = 0 leaves only the immediate reward", async () => {
    const user = userEvent.setup();
    renderApp("/lab/bellman");
    expect(await settled()).toHaveTextContent("Bellman equation laboratory");
    expect(screen.getByText("v(s) = 0.000 + 0.675 = 0.675")).toBeInTheDocument();
    const gamma = screen.getByLabelText("discount rate γ");
    await user.clear(gamma);
    await user.type(gamma, "0");
    expect(screen.getByText("v(s) = 0.000 + 0.000 = 0.000")).toBeInTheDocument();
    const r = screen.getByLabelText("r for north outcome 1");
    await user.clear(r);
    await user.type(r, "10");
    expect(screen.getByText("v(s) = 2.500 + 0.000 = 2.500")).toBeInTheDocument();
    const pi = screen.getByLabelText("π(north | s)");
    await user.clear(pi);
    await user.type(pi, "0.5");
    expect(screen.getByRole("alert")).toHaveTextContent("π(·|s) sums to 1.2500, not 1.");
  });

  test("sweeps of iterative policy evaluation reproduce Figure 4.2's exact iterates", async () => {
    const user = userEvent.setup();
    renderApp("/lab/bellman");
    await ready();
    const it = screen.getByRole("heading", { name: /again and again/ }).closest("section")!;
    await user.click(within(it).getByRole("button", { name: "Next sweep" }));
    await user.click(within(it).getByRole("button", { name: "Next sweep" }));
    expect(within(it).getByText(/^k = 2/)).toBeInTheDocument();
    const cells = Array.from(within(it).getAllByText(/^v_k|v_k/)[0].closest("div")!.querySelectorAll(".vgrid span")).map((s) => s.textContent);
    expect(cells.slice(0, 4)).toEqual(["0.00", "-1.75", "-2.00", "-2.00"]); // exact v_2; Figure 4.2 prints −1.7
    expect(within(it).getByText(/Backing up 1 from/)).toHaveTextContent("= -2.438, which is v_3(1) = -2.438");
    await waitFor(() => expect(within(it).getByText(/Largest gap between v_k and v_π/)).toBeInTheDocument());
  });
});
