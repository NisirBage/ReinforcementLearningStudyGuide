// @vitest-environment jsdom
// Milestone 3E laboratories in the UI: dynamic programming (policy and value iteration), Monte Carlo (episodes,
// returns, first/every visit, ES) and TD (TD(0) stepping, Sarsa and Q-learning inspectors, comparisons).
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { preloadAll, renderApp } from "./helpers";
import { renderMarkdown, texHasError } from "../src/lib/render";
import { loadBundle } from "../../tools/content_loader.ts";

beforeAll(preloadAll);
afterEach(cleanup);
const settled = async () => {
  const h = await screen.findByRole("heading", { level: 1 });
  await waitFor(() => expect(document.activeElement).toBe(h));
  return h;
};

test("the new labs' text renders its maths without errors, and the hub lists six labs", async () => {
  for (const l of loadBundle().labs) for (const t of [l.summary, ...l.guide]) expect(texHasError(renderMarkdown(t)), l.id).toBe(false);
  renderApp("/lab");
  await settled();
  for (const t of ["Dynamic programming laboratory", "Monte Carlo laboratory", "Temporal-difference laboratory"]) expect(screen.getByRole("link", { name: new RegExp(t) })).toBeInTheDocument();
});

describe("dynamic programming laboratory", () => {
  test("policy iteration on the gridworld: evaluation, improvement, then a stable optimal policy", async () => {
    const user = userEvent.setup();
    renderApp("/lab/dp");
    expect(await settled()).toHaveTextContent("Dynamic programming laboratory");
    expect(screen.getByText(/Evaluation 0:/).closest("p")).toHaveTextContent(/sweeps of in-place policy evaluation/);
    await user.click(screen.getByRole("button", { name: "Improve the policy" }));
    expect(screen.getByText(/Improvement 1:/).closest("p")).toHaveTextContent("14 states changed action");
    await user.click(screen.getByRole("button", { name: "Evaluate the new policy" }));
    expect(screen.getByText(/Evaluation 1:/).closest("p")).toHaveTextContent("the policy is stable, hence optimal");
    const grid = screen.getByRole("table", { name: /Values and greedy actions on the 4×4 gridworld/ });
    expect(within(grid).getByRole("cell", { name: /row 1, column 2, value -1\.0, best left/ })).toBeInTheDocument();
  });

  test("value iteration on the gambler's problem reaches v(50) = 0.4; policy iteration is not offered there", async () => {
    const user = userEvent.setup();
    renderApp("/lab/dp");
    await settled();
    await user.selectOptions(screen.getByLabelText(/^Problem/), "gambler");
    expect(screen.getByRole("option", { name: "policy iteration" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /To convergence/ }));
    expect(screen.getByText(/converged/)).toBeInTheDocument();
    await user.click(screen.getAllByText("Show as a table")[0]);
    const table = screen.getAllByRole("table")[0];
    const row50 = within(table).getAllByRole("row").find((r) => r.querySelector("th")?.textContent === "50")!;
    expect(row50).toHaveTextContent("0.400");
  });
});

describe("Monte Carlo laboratory", () => {
  test("an episode's returns are shown with first visits marked and each update written out", async () => {
    const user = userEvent.setup();
    renderApp("/lab/mc");
    await settled();
    const pred = screen.getByRole("heading", { name: "Monte Carlo prediction" }).closest("section")!;
    await user.click(within(pred).getByRole("button", { name: "Generate an episode" }));
    expect(screen.getByText(/^1 episode ·/)).toBeInTheDocument();
    const rows = screen.getByRole("heading", { name: /The last episode/ }).parentElement!.querySelectorAll("table tbody tr");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].textContent).toMatch(/first/);
    expect(rows[0].textContent).toMatch(/0\.500 \+ 1\.000·\(/); // sample average: first update has step 1/1
    await user.click(within(pred).getByRole("button", { name: "+1000 episodes" }));
    expect(within(pred).getByText(/^1001 episodes ·/)).toBeInTheDocument();
    const rms = Number(/RMS error over the nonterminal states: ([\d.]+)/.exec(screen.getByText(/RMS error over/).textContent!)![1]);
    expect(rms).toBeLessThan(0.05);
  });

  test("Monte Carlo ES on the gridworld counts its episodes and those cut off (and, since 4B, discards them)", async () => {
    const user = userEvent.setup();
    renderApp("/lab/mc");
    await settled();
    const es = screen.getByRole("heading", { name: /Monte Carlo ES/ }).closest("section")!;
    await user.selectOptions(within(es).getByLabelText(/^Problem/), "grid"); // blackjack is the default since Milestone 4B
    await user.click(within(es).getByRole("button", { name: "+1000 episodes" }));
    expect(within(es).getByText(/^1000 episodes · \d+ cut off at 50 steps and discarded/)).toBeInTheDocument();
  });
});

describe("temporal-difference laboratory", () => {
  test("TD(0) shows the target, TD error and new value of each step", async () => {
    const user = userEvent.setup();
    renderApp("/lab/td");
    await settled();
    await user.click(screen.getAllByRole("button", { name: "Step" })[0]);
    const calc = document.querySelector("pre.calc")!.textContent!;
    expect(calc).toMatch(/^S_t = C, R_t\+1 = 0, S_t\+1 = [BD]/);
    expect(calc).toMatch(/TD target = R \+ γ V\(S_t\+1\) = 0 \+ 1 · 0\.500 = 0\.500/);
    expect(calc).toMatch(/TD error δ = target − V\(S_t\) = 0\.500 − 0\.500 = 0\.000/);
  });

  test("the control inspector shows every quantity, with Q-learning's max and Sarsa's next action", async () => {
    const user = userEvent.setup();
    renderApp("/lab/td");
    await settled();
    const ctl = screen.getByRole("heading", { name: /Sarsa and Q-learning, one update at a time/ }).closest("section")!;
    await user.click(within(ctl).getByRole("button", { name: "Step" }));
    let text = ctl.querySelector("pre.calc")!.textContent!;
    for (const part of ["S_t = (4,1)", "A_t = ", "R_t+1 = ", "S_t+1 = ", "Q(S_t, A_t) = 0.000", "max_a Q(S_t+1, a) = 0.000", "TD target = R_t+1 + γ · max_a Q(S_t+1, a)", "TD error δ", "Q(S_t, A_t) ← 0.000 + 0.5 · "]) expect(text).toContain(part);
    await user.selectOptions(within(ctl).getByLabelText(/^Method/), "sarsa");
    await user.click(within(ctl).getByRole("button", { name: "Step" }));
    text = ctl.querySelector("pre.calc")!.textContent!;
    expect(text).toContain("A_t+1 = ");
    expect(text).toContain("TD target = R_t+1 + γ · Q(S_t+1, A_t+1)");
    await user.click(within(ctl).getByRole("button", { name: "+50 episodes" }));
    expect(within(ctl).getByText(/episode 51/)).toBeInTheDocument();
  });

  test("comparing Sarsa and Q-learning on cliff walking draws the reward curves", async () => {
    const user = userEvent.setup();
    renderApp("/lab/td");
    await settled();
    const cmp = screen.getByRole("heading", { name: /Compare Sarsa and Q-learning/ }).closest("section")!;
    const runs = within(cmp).getByLabelText("number of runs");
    await user.clear(runs);
    await user.type(runs, "2");
    await user.click(within(cmp).getByRole("button", { name: "Run" }));
    expect(await within(cmp).findByText(/Reward per episode \(average of 2 runs/, {}, { timeout: 15_000 })).toBeInTheDocument();
    expect(within(cmp).getByText(/Q-learning: greedy path 13 steps on average/)).toBeInTheDocument();
  });
});
