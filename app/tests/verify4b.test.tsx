// @vitest-environment jsdom
// Milestone 4B: the random-number generator, the blackjack model (checked by simulating the actual card game),
// Monte Carlo ES with exploring starts and with cut-off episodes discarded, and the windy-gridworld findings.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { makeRng, type Rng } from "../src/domain/random";
import { CHECKS } from "../src/content/checks";
import { CARD_P, DEAL_STATE, END, HIT, addCard, bjIndex, bjStartPairs, bjState, blackjack, dealerFinal, stickOn20 } from "../src/lib/rl/envs/blackjack";
import { solveExact, type FiniteMDP } from "../src/lib/rl/mdp";
import { esEpisode, newEs, runEs } from "../src/lib/rl/mc";
import { gridworld4x4 } from "../src/lib/rl/envs/gridworld4x4";
import { preloadAll, renderApp } from "./helpers";

afterEach(cleanup);
const fact = (id: string) => (CHECKS[id] as { run: () => boolean }).run();

describe("random-number generator (mulberry32)", () => {
  const draws = (seed: number, n: number) => {
    const r = makeRng(seed);
    return Array.from({ length: n }, () => r());
  };

  test("is reproducible per seed, differs between seeds, and stays in [0, 1)", () => {
    expect(draws(42, 5)).toEqual(draws(42, 5));
    expect(draws(42, 5)).not.toEqual(draws(43, 5));
    const xs = draws(1, 200_000);
    expect(xs.reduce((a, b) => Math.min(a, b), 1)).toBeGreaterThanOrEqual(0);
    expect(xs.reduce((a, b) => Math.max(a, b), 0)).toBeLessThan(1);
  });

  test("is uniform: mean, variance and a chi-squared test over 20 bins", () => {
    const n = 200_000;
    const xs = draws(7, n);
    const mean = xs.reduce((a, b) => a + b, 0) / n;
    const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.003); // standard error 0.00065
    expect(Math.abs(v - 1 / 12)).toBeLessThan(0.001);
    const bins = new Array(20).fill(0);
    for (const x of xs) bins[Math.floor(x * 20)]++;
    const chi2 = bins.reduce((a, o) => a + (o - n / 20) ** 2 / (n / 20), 0);
    expect(chi2).toBeLessThan(43.82); // the 0.1% critical value for 19 degrees of freedom
  });

  test("successive draws, and the first draws of successive seeds, are uncorrelated", () => {
    const corr = (a: number[], b: number[]) => {
      const m = (x: number[]) => x.reduce((s, y) => s + y, 0) / x.length;
      const ma = m(a), mb = m(b);
      let num = 0, da = 0, db = 0;
      for (let i = 0; i < a.length; i++) {
        num += (a[i] - ma) * (b[i] - mb);
        da += (a[i] - ma) ** 2;
        db += (b[i] - mb) ** 2;
      }
      return num / Math.sqrt(da * db);
    };
    const xs = draws(11, 100_001);
    expect(Math.abs(corr(xs.slice(0, -1), xs.slice(1)))).toBeLessThan(0.01); // standard error 0.003
    // The labs seed runs 1, 2, 3, …: their first values must look independent too.
    const first = Array.from({ length: 20_001 }, (_, s) => makeRng(s + 1)());
    expect(Math.abs(corr(first.slice(0, -1), first.slice(1)))).toBeLessThan(0.03);
    const bins = new Array(10).fill(0);
    for (const x of first) bins[Math.floor(x * 10)]++;
    expect(bins.reduce((a, o) => a + (o - first.length / 10) ** 2 / (first.length / 10), 0)).toBeLessThan(27.88); // 0.1%, 9 d.f.
  });
});

/** The card game itself, played with random cards: an independent check of the exact model. */
function playGame(rng: Rng, choose: (sum: number, dealer: number, usable: boolean) => "stick" | "hit", startAt?: { sum: number; dealer: number; usable: boolean }): number {
  const card = () => {
    const u = Math.floor(rng() * 13) + 1;
    return u > 10 ? 10 : u;
  };
  const hand = (cards: number[]) => cards.reduce((h, c) => addCard(h.sum, h.usable, c), { sum: 0, usable: false });
  let dealerShow: number, me: { sum: number; usable: boolean };
  if (startAt) {
    dealerShow = startAt.dealer;
    me = { sum: startAt.sum, usable: startAt.usable };
  } else {
    dealerShow = card();
    const cards = [card(), card()];
    me = hand(cards);
    const hidden = card();
    const dealerNatural = hand([dealerShow, hidden]).sum === 21;
    if (me.sum === 21) return dealerNatural ? 0 : 1;
    while (me.sum < 12) me = addCard(me.sum, me.usable, card());
    return finish(me, dealerShow, hidden);
  }
  return finish(me, dealerShow, card());

  function finish(p: { sum: number; usable: boolean }, show: number, hidden: number) {
    while (choose(p.sum, show, p.usable) === "hit") {
      p = addCard(p.sum, p.usable, card());
      if (p.sum > 21) return -1;
    }
    let d = hand([show, hidden]);
    while (d.sum < 17) d = addCard(d.sum, d.usable, card());
    return d.sum > 21 || p.sum > d.sum ? 1 : p.sum === d.sum ? 0 : -1;
  }
}

describe("blackjack (Example 5.1)", () => {
  const m = blackjack();
  const pi = stickOn20();
  const v = solveExact(m, pi, 1)!;

  test("has the draft's 200 states, stick and hit in each, and exact probabilities", () => {
    expect(m.states).toHaveLength(202);
    expect(fact("bj.dynamics")).toBe(true);
    expect(bjState(bjIndex(13, 2, true))).toEqual({ sum: 13, dealer: 2, usable: true });
    // A natural needs an ace and a 10-card: probability 2 · (1/13)(4/13) = 8/169.
    const toEnd = m.dynamics[DEAL_STATE][2].filter((t) => t.next === END).reduce((s, t) => s + t.prob, 0);
    expect(toEnd).toBeCloseTo(8 / 169, 12);
    expect(CARD_P.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  test("counts aces as the draft says", () => {
    expect(addCard(0, false, 1)).toEqual({ sum: 11, usable: true });
    expect(addCard(11, true, 10)).toEqual({ sum: 21, usable: true });
    expect(addCard(15, true, 9)).toEqual({ sum: 14, usable: false }); // the ace drops back to 1
    expect(addCard(14, false, 1)).toEqual({ sum: 15, usable: false });
  });

  test("the dealer's final sums sum to 1, and a showing 6 busts most often", () => {
    const bust = Array.from({ length: 10 }, (_, k) => dealerFinal(k + 1).get(22)!);
    for (let d = 1; d <= 10; d++) expect([...dealerFinal(d).values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(bust.indexOf(Math.max(...bust))).toBe(5);
  });

  test("the exact model agrees with playing the game: 200,000 simulated games and Example 5.4's state", () => {
    const rng = makeRng(2026);
    const play = (start?: { sum: number; dealer: number; usable: boolean }) => playGame(rng, (sum) => (sum >= 20 ? "stick" : "hit"), start);
    const n = 200_000;
    let g = 0;
    for (let i = 0; i < n; i++) g += play();
    expect(Math.abs(g / n - v[DEAL_STATE])).toBeLessThan(4 * (1 / Math.sqrt(n))); // returns lie in [−1, 1]
    let h = 0;
    for (let i = 0; i < n; i++) h += play({ sum: 13, dealer: 2, usable: true });
    expect(Math.abs(h / n - v[bjIndex(13, 2, true)])).toBeLessThan(4 / Math.sqrt(n));
  });

  test("Example 5.4's value and Figure 5.5's optimal policy are reproduced exactly", () => {
    expect(v[bjIndex(13, 2, true)]).toBeCloseTo(-0.2772, 4);
    expect(fact("bj.example-5-4")).toBe(true);
    expect(fact("bj.figure-5-5")).toBe(true);
  });
});

describe("Monte Carlo ES", () => {
  test("the fast runner makes exactly the updates of repeated single episodes (blackjack and gridworld)", () => {
    const m = blackjack();
    const pol = stickOn20().map((r) => r.indexOf(1));
    let st = newEs(m, pol);
    const a = makeRng(5), b = makeRng(5);
    for (let e = 0; e < 2000; e++) st = esEpisode(m, st, 1, a, { starts: bjStartPairs() }).state;
    expect(runEs(m, 2000, 1, b, { starts: bjStartPairs(), policy0: pol }).state).toEqual(st);
    const g = gridworld4x4();
    let gs = newEs(g);
    let cut = 0;
    const c = makeRng(9), d = makeRng(9);
    for (let e = 0; e < 500; e++) {
      const out = esEpisode(g, gs, 1, c, { maxSteps: 50 });
      gs = out.state;
      cut += out.truncated ? 1 : 0;
    }
    const fast = runEs(g, 500, 1, d, { maxSteps: 50 });
    expect(fast.state).toEqual(gs);
    expect(fast.truncated).toBe(cut);
  });

  test("starts only from the given pairs, and continues from a state without changing it", () => {
    const m = blackjack();
    const out = esEpisode(m, newEs(m), 1, makeRng(3), { starts: [[bjIndex(13, 2, true), HIT]] });
    expect(out.steps[0]).toMatchObject({ s: bjIndex(13, 2, true), a: HIT });
    const s0 = runEs(m, 100, 1, makeRng(1), { starts: bjStartPairs() }).state;
    const copy = JSON.stringify(s0);
    runEs(m, 100, 1, makeRng(2), { starts: bjStartPairs(), from: s0 });
    expect(JSON.stringify(s0)).toBe(copy);
  });

  // A state whose only action stays put (it never ends), next to a long corridor that does end.
  const loopAndCorridor = (len: number): FiniteMDP => ({
    states: ["loop", ...Array.from({ length: len }, (_, i) => `c${i}`), "end"],
    terminal: [false, ...Array.from({ length: len }, () => false), true],
    actions: ["go"],
    dynamics: [[[{ next: 0, reward: -1, prob: 1 }]], ...Array.from({ length: len }, (_, i) => [[{ next: i + 2, reward: -1, prob: 1 }]]), [[]]],
  });

  test("an episode that never ends is cut off and discarded: no update to Q, N or π", () => {
    const m = loopAndCorridor(3);
    const st = newEs(m);
    const out = esEpisode(m, st, 1, makeRng(1), { starts: [[0, 0]], maxSteps: 25 });
    expect(out.truncated).toBe(true);
    expect(out.steps).toHaveLength(25);
    expect(out.updates).toEqual([]);
    expect(out.state).toBe(st);
    const r = runEs(m, 200, 1, makeRng(1), { starts: [[0, 0]], maxSteps: 25 });
    expect(r.truncated).toBe(200);
    expect(r.state.N.flat().every((n) => n === 0)).toBe(true);
  });

  test("a long episode that does end is used in full", () => {
    const m = loopAndCorridor(400);
    const out = esEpisode(m, newEs(m), 1, makeRng(1), { starts: [[1, 0]] });
    expect(out.truncated).toBe(false);
    expect(out.steps).toHaveLength(400);
    expect(out.updates).toHaveLength(400);
    expect(out.state.Q[1][0]).toBe(-400); // the return from the corridor's first cell
  });

  test("on blackjack it learns the optimal policy; on the gridworld, discarding cut-off episodes makes it stall", () => {
    expect(fact("lab.mc.es-blackjack")).toBe(true);
    expect(fact("lab.mc.es-needs-termination")).toBe(true);
  });
});

describe("windy gridworld (Example 6.5)", () => {
  test("the draft's 17 steps is the ε-greedy length around the optimal policy, and Sarsa reaches it with α = 0.1", () => {
    expect(fact("lab.td.windy-17-steps")).toBe(true);
    expect(fact("lab.td.windy-sarsa-settles")).toBe(true);
    expect(fact("lab.td.windy-fig6-11")).toBe(true);
  });
});

describe("in the laboratory", () => {
  beforeAll(preloadAll);
  const settled = async () => {
    const h = await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(document.activeElement).toBe(h));
  };

  test("Monte Carlo ES starts on blackjack and shows its policy against the exact optimum", async () => {
    const user = userEvent.setup();
    renderApp("/lab/mc");
    await settled();
    const es = screen.getByRole("heading", { name: /Monte Carlo ES/ }).closest("section")!;
    expect(within(es).getByLabelText(/^Problem/)).toHaveValue("blackjack");
    await user.click(within(es).getByRole("button", { name: "One episode" }));
    expect(within(es).getByText(/^1 episode · learned policy optimal in \d+ of 200 states/)).toBeInTheDocument();
    expect(within(es).getByText(/^Last episode: /)).toBeInTheDocument();
    await user.click(within(es).getByRole("button", { name: "+10,000 episodes" }));
    const status = within(es).getByText(/^10,001 episodes · learned policy optimal in (\d+) of 200 states/);
    expect(Number(/in (\d+) of/.exec(status.textContent!)![1])).toBeGreaterThan(150);
    expect(within(es).getByRole("table", { name: /^Learned policy, usable ace:/ })).toBeInTheDocument();
    expect(within(es).getByRole("table", { name: /^Learned policy, no usable ace:/ })).toBeInTheDocument();
    expect(within(es).getAllByRole("cell", { name: "sum 21, dealer ace: stick" })).toHaveLength(2); // both tables: never hit on 21
  });

  test("the TD lab carries the windy-gridworld finding as a flag", async () => {
    renderApp("/lab/td");
    await settled();
    expect(screen.getAllByText(/Measured differently from the draft/).length).toBeGreaterThan(0);
  });
});
