// Milestone 3E algorithms: policy improvement, policy iteration, value iteration; the draft's environments;
// sampling; Monte Carlo prediction (first/every visit, sample average, constant α) and ES; TD(0), Sarsa, Q-learning.
// Update rules are checked exactly against hand computation; behaviour against the draft's examples.
import { describe, expect, test } from "vitest";
import { makeRng } from "../src/domain/random";
import { deterministic, greedyPolicy, policyIteration, valueIteration } from "../src/lib/rl/dp";
import { equiprobablePolicy, solveExact, type FiniteMDP } from "../src/lib/rl/mdp";
import { gridworld4x4, toCells } from "../src/lib/rl/envs/gridworld4x4";
import { RANDOM_WALK_TRUE, WINDY_WIND, cliffWalking, gamblersProblem, randomWalk, windyGridworld } from "../src/lib/rl/envs/examples";
import { generateEpisode, sampleStep, type Step } from "../src/lib/rl/sampling";
import { mcUpdate, newPrediction, returnsOf } from "../src/lib/rl/mc";
import { controlStep, greedyPath, newControl, qLearningStep, runControl, sarsaStep, td0Update } from "../src/lib/rl/td";

const close = (a: number, b: number, tol = 1e-12) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);
const g = gridworld4x4();

describe("policy improvement, policy iteration and value iteration", () => {
  test("greedy improvement (4.9) lists ties and keeps the current action when it is still among them", () => {
    const v = toCells(solveExact(g, equiprobablePolicy(g), 1)!);
    const vs = [0, ...v.slice(1, 15)];
    const imp = greedyPolicy(g, vs, 1);
    expect(imp.ties[1]).toEqual([3]); // state 1: only left (towards the corner)
    expect(imp.ties[6].length).toBeGreaterThan(1); // several best moves in the middle
    const keep = greedyPolicy(g, vs, 1, g.states.map(() => imp.ties[6][1]));
    expect(keep.actions[6]).toBe(imp.ties[6][1]);
  });
  test("policy iteration from the random policy: one improvement gives an optimal policy (p. 98)", () => {
    const run = policyIteration(g, 1);
    expect(run.stable).toBe(true);
    expect(run.steps).toHaveLength(2);
    expect(toCells(run.steps[1].v).map((x) => Math.round(x))).toEqual([0, -1, -2, -3, -1, -2, -3, -2, -2, -3, -2, -1, -3, -2, -1, 0]);
    expect(run.steps[1].changed).toEqual([]);
  });
  test("a deterministic policy that loops for ever with γ = 1 is reported as diverging (Exercise 4.4)", () => {
    const up = g.actions.indexOf("up");
    const run = policyIteration(g, 1, { initial: deterministic(g, g.states.map(() => up)), maxSweeps: 2000 });
    expect(run.diverged).toBe(true);
  });
  test("value iteration (4.10): in place and two-array reach the same v*; Δ falls below θ", () => {
    const a = valueIteration(g, 1, { mode: "in-place" });
    const b = valueIteration(g, 1, { mode: "two-array", record: true });
    a.v.forEach((x, s) => close(x, b.v[s]));
    expect(b.deltas.at(-1)!).toBeLessThan(1e-10);
    expect(b.history[1].slice(1, 15).every((x) => x === -1)).toBe(true); // first sweep: −1 everywhere
  });
  test("gambler's problem, p_h = 0.4: bold-play values and a stake of 50 at $50 (Example 4.3)", () => {
    const vi = valueIteration(gamblersProblem(0.4), 1, { theta: 1e-13 });
    close(vi.v[50], 0.4, 1e-9);
    close(vi.v[25], 0.16, 1e-9);
    close(vi.v[75], 0.64, 1e-9);
    expect(vi.policy.ties[50]).toContain(50);
    expect(vi.policy.ties[50]).toContain(0); // stake 0 ties under γ = 1, which is why the lab shows the smallest positive stake
    // More capital never hurts ($1–$99; the terminal $100 has value 0 because its +1 is paid on the way in).
    for (let s = 1; s < 99; s++) expect(vi.v[s]).toBeLessThanOrEqual(vi.v[s + 1] + 1e-12);
  });
  test("gambler's stakes are limited to min(s, 100 − s)", () => {
    const m = gamblersProblem(0.4);
    expect(m.dynamics[30].filter((o) => o.length).length).toBe(31); // stakes 0…30
    expect(m.dynamics[70].filter((o) => o.length).length).toBe(31); // stakes 0…30
    expect(m.dynamics[0].every((o) => o.length === 0)).toBe(true);
  });
});

describe("environments from the draft", () => {
  test("random walk: true values 1/6 … 5/6 (Example 6.2)", () => {
    const rw = randomWalk();
    solveExact(rw, equiprobablePolicy(rw), 1)!.forEach((x, s) => close(x, RANDOM_WALK_TRUE[s], 1e-12));
  });
  test("windy gridworld: the draft's example move, the wind table and the 15-step minimum (Example 6.5)", () => {
    const w = windyGridworld();
    expect(WINDY_WIND).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 1, 0]);
    const rightOfGoal = 3 * 10 + 8;
    const left = w.actions.indexOf("left");
    expect(w.dynamics[rightOfGoal][left][0].next).toBe(2 * 10 + 7); // "the action left takes you to the cell just above the goal"
    expect(valueIteration(w, 1).v[w.grid.start]).toBe(-15);
  });
  test("cliff walking: stepping into the cliff costs −100 and returns to the start (Example 6.6)", () => {
    const c = cliffWalking();
    const right = c.actions.indexOf("right");
    expect(c.dynamics[c.grid.start][right][0]).toEqual({ next: c.grid.start, reward: -100, prob: 1 });
    const up = c.actions.indexOf("up");
    expect(c.dynamics[c.grid.start][up][0]).toEqual({ next: c.grid.start - 12, reward: -1, prob: 1 });
    expect(valueIteration(c, 1).v[c.grid.start]).toBe(-13); // the optimal path along the edge
  });
});

describe("sampling", () => {
  test("transitions are sampled with their probabilities; long episodes are cut and marked", () => {
    const rw = randomWalk();
    const rng = makeRng(4);
    let right = 0;
    for (let i = 0; i < 20_000; i++) if (sampleStep(rw, 3, 0, rng).next === 4) right++;
    expect(Math.abs(right / 20_000 - 0.5)).toBeLessThan(0.01);
    const up = g.actions.indexOf("up");
    const loop = generateEpisode(g, deterministic(g, g.states.map(() => up)), 1, makeRng(1), { maxSteps: 30 });
    expect(loop.truncated).toBe(true);
    expect(loop.steps).toHaveLength(30);
  });
});

describe("Monte Carlo", () => {
  // C → B → C → D → E → right end: rewards 0, 0, 0, 0, 1.
  const ep: Step[] = [
    { t: 0, s: 3, a: 0, r: 0, next: 2 },
    { t: 1, s: 2, a: 0, r: 0, next: 3 },
    { t: 2, s: 3, a: 0, r: 0, next: 4 },
    { t: 3, s: 4, a: 0, r: 0, next: 5 },
    { t: 4, s: 5, a: 0, r: 1, next: 6 },
  ];
  test("returns are computed backwards: G_t = R_{t+1} + γ G_{t+1}", () => {
    expect(returnsOf(ep, 1)).toEqual([1, 1, 1, 1, 1]);
    returnsOf(ep, 0.9).forEach((x, t) => close(x, 0.9 ** (4 - t)));
  });
  test("first-visit updates C once; every-visit twice; sample averages are exact means", () => {
    const fv = mcUpdate(newPrediction(7), ep, 0.5, true);
    expect(fv.state.N[3]).toBe(1);
    close(fv.state.V[3], 0.5 ** 4);
    const ev = mcUpdate(newPrediction(7), ep, 0.5, false);
    expect(ev.state.N[3]).toBe(2);
    close(ev.state.V[3], (0.5 ** 4 + 0.5 ** 2) / 2); // the average of the returns after both visits
    expect(ev.updates.filter((u) => u.s === 3).map((u) => u.first)).toEqual([true, false]);
  });
  test("constant-α MC (6.1): V ← V + α(G − V)", () => {
    const st = newPrediction(7, 0.5);
    const out = mcUpdate(st, ep, 1, false, 0.1);
    const u = out.updates[0];
    close(u.after, 0.5 + 0.1 * (1 - 0.5));
    close(out.state.V[3], 0.55 + 0.1 * (1 - 0.55)); // second visit builds on the first
  });
});

describe("TD(0), Sarsa and Q-learning", () => {
  test("TD(0) (6.2): target R + γV(S′), error, update; V of a terminal state is 0", () => {
    const rw = randomWalk();
    const V = [9, 0.5, 0.5, 0.5, 0.5, 0.5, 9]; // terminal entries ignored
    const d = td0Update(V, rw, 5, 1, 6, 0.1, 1);
    expect(d).toMatchObject({ vNext: 0, target: 1, delta: 0.5 });
    close(V[5], 0.55);
    const d2 = td0Update(V, rw, 4, 0, 5, 0.1, 0.9);
    close(d2.target, 0.9 * 0.55);
    close(V[4], 0.5 + 0.1 * (0.9 * 0.55 - 0.5));
  });

  // Two steps: s0 --(either action, −1)--> s1 --(either action, 0)--> T.
  const tiny: FiniteMDP = {
    states: ["s0", "s1", "T"],
    terminal: [false, false, true],
    actions: ["a", "b"],
    dynamics: [[[{ next: 1, reward: -1, prob: 1 }], [{ next: 1, reward: -1, prob: 1 }]], [[{ next: 2, reward: 0, prob: 1 }], [{ next: 2, reward: 0, prob: 1 }]], [[], []]],
  };
  const withQ = (q: number[][]) => ({ ...newControl(tiny, 0), Q: q });
  test("Sarsa bootstraps from the action it will take; Q-learning from the best action (they differ)", () => {
    const Q = [[0, 0], [5, -5], [0, 0]];
    for (let seed = 1; seed <= 40; seed++) {
      const s = sarsaStep(tiny, withQ(Q), { method: "sarsa", alpha: 0.5, epsilon: 1, gamma: 1 }, makeRng(seed), 0);
      const q = qLearningStep(tiny, withQ(Q), { method: "q-learning", alpha: 0.5, epsilon: 1, gamma: 1 }, makeRng(seed), 0);
      expect(s.detail.bootstrap).toBe(Q[1][s.detail.nextAction!]); // Q(S′, A′)
      expect(q.detail.bootstrap).toBe(5); // max_a Q(S′, a)
      close(s.detail.after, s.detail.qSA + 0.5 * (-1 + s.detail.bootstrap - s.detail.qSA));
      close(q.detail.after, 0 + 0.5 * (-1 + 5 - 0));
      expect(q.detail.nextAction).toBeNull();
    }
  });
  test("Sarsa takes the A′ it chose; at a terminal S′ both bootstrap from 0", () => {
    const cfg = { method: "sarsa" as const, alpha: 0.5, epsilon: 0.5, gamma: 1 };
    const first = sarsaStep(tiny, withQ([[0, 0], [1, 2], [0, 0]]), cfg, makeRng(3), 0);
    const second = sarsaStep(tiny, first.state, cfg, makeRng(4), 0);
    expect(second.detail.a).toBe(first.detail.nextAction);
    expect(second.detail).toMatchObject({ terminal: true, bootstrap: 0, nextAction: null });
    const q = qLearningStep(tiny, { ...withQ([[0, 0], [1, 2], [0, 0]]), s: 1 }, { ...cfg, method: "q-learning" }, makeRng(5), 0);
    expect(q.detail).toMatchObject({ terminal: true, bootstrap: 0 });
  });
  test("ε = 0 picks a greedy action; whole runs count episodes and rewards correctly", () => {
    const st = withQ([[1, 3], [0, 0], [0, 0]]);
    const out = controlStep(tiny, st, { method: "q-learning", alpha: 0.5, epsilon: 0, gamma: 1 }, makeRng(1), 0);
    expect(out.detail.a).toBe(1);
    const run = runControl(tiny, 0, { method: "sarsa", alpha: 0.5, epsilon: 0.1, gamma: 1 }, makeRng(2), { episodes: 10 });
    expect(run.rewards).toEqual(new Array(10).fill(-1));
    expect(run.lengths).toEqual(new Array(10).fill(2));
    expect(run.endedAt).toEqual(Array.from({ length: 10 }, (_, i) => 2 * (i + 1)));
  });
  test("cliff walking: Q-learning's greedy path runs along the edge; Sarsa's keeps away (Figure 6.13)", () => {
    const c = cliffWalking();
    const q = runControl(c, c.grid.start, { method: "q-learning", alpha: 0.5, epsilon: 0.1, gamma: 1 }, makeRng(11), { episodes: 500 });
    const s = runControl(c, c.grid.start, { method: "sarsa", alpha: 0.5, epsilon: 0.1, gamma: 1 }, makeRng(11), { episodes: 500 });
    const qp = greedyPath(c, q.Q, c.grid.start)!;
    expect(qp).toHaveLength(14);
    expect(qp.slice(1, -1).every((x) => Math.floor(x / 12) === 2)).toBe(true); // the row just above the cliff
    const sp = greedyPath(c, s.Q, c.grid.start);
    expect(sp === null || sp.length > 14).toBe(true);
  });
});
