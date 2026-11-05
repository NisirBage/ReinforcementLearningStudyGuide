// Milestone 3D algorithms: bandit agents (exact update arithmetic, the draft's statements about each method, the
// gradient bandit as stochastic gradient ascent), the experiment runner, MDP quantities (3.7)–(3.9), the exact solver,
// the Bellman backup terms, and the MDP editor's checks.
import { describe, expect, test } from "vitest";
import {
  TESTBED_10, agentStep, argmaxRandom, expectedMaxNormal, finishCurves, gaussian, newAgent, recordRun, runBlock, runExperiment, sample, softmax, type Method,
} from "../src/lib/rl/banditLab";
import { makeRng } from "../src/domain/random";
import { backupTerms, bellmanExpectationBackup, equiprobablePolicy, expectedReward, expectedRewardGivenNext, solveExact, transitionProb } from "../src/lib/rl/mdp";
import { gridworld4x4, toCells } from "../src/lib/rl/envs/gridworld4x4";
import { recyclingRandomPolicy, recyclingRobot } from "../src/lib/rl/envs/recycling";
import { addState, blankSpec, checkSpec, gridworldSpec, recyclingSpec, removeState, setOutcomes, setPolicy, toMdp, uniformPolicy } from "../src/domain/mdpModel";
import { iterativePolicyEvaluation } from "../src/lib/rl/dp";

const SA = { kind: "sample-average" } as const;
const close = (a: number, b: number, tol = 1e-12) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe("building blocks", () => {
  test("soft-max (2.9): probabilities sum to 1, and adding 1000 to every preference changes nothing (p. 43)", () => {
    const h = [0.3, -1.2, 2.5, 0];
    const p = softmax(h);
    close(p.reduce((a, b) => a + b, 0), 1);
    softmax(h.map((x) => x + 1000)).forEach((x, i) => close(x, p[i], 1e-12));
    expect(softmax([800, 0]).every(Number.isFinite)).toBe(true); // no overflow
  });
  test("ties are broken uniformly at random; sampling follows the probabilities", () => {
    const rng = makeRng(3);
    const hits = [0, 0, 0, 0];
    for (let i = 0; i < 40_000; i++) hits[argmaxRandom([1, 5, 5, 5], rng)]++;
    expect(hits[0]).toBe(0);
    for (const h of hits.slice(1)) expect(Math.abs(h / 40_000 - 1 / 3)).toBeLessThan(0.015);
    const s = [0, 0, 0];
    for (let i = 0; i < 40_000; i++) s[sample([0.2, 0.5, 0.3], rng)]++;
    s.forEach((x, i) => expect(Math.abs(x / 40_000 - [0.2, 0.5, 0.3][i])).toBeLessThan(0.015));
  });
  test("the Gaussian sampler has mean 0 and variance 1", () => {
    const rng = makeRng(9);
    const xs = Array.from({ length: 100_000 }, () => gaussian(rng));
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
    expect(Math.abs(m)).toBeLessThan(0.01);
    expect(Math.abs(v - 1)).toBeLessThan(0.02);
  });
  test("E[max of n standard normals]: exact small cases and the draft's 'about 1.55' for n = 10", () => {
    close(expectedMaxNormal(1), 0, 1e-9);
    close(expectedMaxNormal(2), 1 / Math.sqrt(Math.PI), 1e-9);
    expect(expectedMaxNormal(10)).toBeCloseTo(1.5388, 4);
  });
});

describe("bandit agents: every step's arithmetic", () => {
  const q = [0.2, -0.5, 1.1, 0.4];
  test("sample averages: Q ← Q + (1/N)(R − Q), so each estimate is the mean of its rewards", () => {
    const rng = makeRng(5);
    let s = newAgent({ kind: "epsilon-greedy", epsilon: 0.5, q1: 0, step: SA }, 4);
    const rewards: number[][] = [[], [], [], []];
    for (let i = 0; i < 200; i++) {
      const { state, detail: d } = agentStep(s, q, 1, rng);
      rewards[d.action].push(d.reward);
      close(d.after[d.action], d.before[d.action] + d.stepSize! * (d.reward - d.before[d.action]));
      expect(d.stepSize).toBe(1 / rewards[d.action].length);
      s = state;
    }
    rewards.forEach((r, a) => r.length && close(s.values[a], r.reduce((x, y) => x + y, 0) / r.length, 1e-9));
  });
  test("constant α (2.5) with optimistic Q₁ = 5: estimates start at 5 and move by α(R − Q)", () => {
    const rng = makeRng(6);
    let s = newAgent({ kind: "epsilon-greedy", epsilon: 0, q1: 5, step: { kind: "constant", alpha: 0.1 } }, 4);
    expect(s.values).toEqual([5, 5, 5, 5]);
    const tried = new Set<number>();
    for (let i = 0; i < 30; i++) {
      const { state, detail: d } = agentStep(s, q, 1, rng);
      close(d.after[d.action], d.before[d.action] + 0.1 * (d.reward - d.before[d.action]));
      tried.add(d.action);
      s = state;
    }
    expect(tried.size).toBe(4); // §2.5: optimism makes even a greedy learner try every action
  });
  test("ε-greedy explores with probability ε", () => {
    const rng = makeRng(8);
    let s = newAgent({ kind: "epsilon-greedy", epsilon: 0.2, q1: 0, step: SA }, 4);
    let explored = 0;
    for (let i = 0; i < 20_000; i++) {
      const out = agentStep(s, q, 1, rng);
      if (out.detail.explored) explored++;
      s = out.state;
    }
    expect(Math.abs(explored / 20_000 - 0.2)).toBeLessThan(0.01);
  });
  test("UCB tries every untried action first (N = 0 counts as maximizing), then uses (2.8)", () => {
    const rng = makeRng(10);
    let s = newAgent({ kind: "ucb", c: 2, q1: 0, step: SA }, 4);
    const first: number[] = [];
    for (let i = 0; i < 4; i++) {
      const out = agentStep(s, q, 1, rng);
      first.push(out.detail.action);
      expect(out.detail.scores![out.detail.action]).toBe(Infinity);
      s = out.state;
    }
    expect(new Set(first).size).toBe(4);
    const out = agentStep(s, q, 1, rng);
    s.values.forEach((v, a) => close(out.detail.scores![a], v + 2 * Math.sqrt(Math.log(5) / s.counts[a])));
  });
  test("gradient bandit (2.10): exact update, with R̄ₜ including Rₜ as the draft defines it", () => {
    const rng = makeRng(12);
    let s = newAgent({ kind: "gradient", alpha: 0.1, baseline: true }, 3);
    // Step 1: R̄₁ = R₁, so R₁ − R̄₁ = 0 and no preference moves.
    let out = agentStep(s, [1, 0, 0], 1, rng);
    close(out.detail.baseline!, out.detail.reward);
    expect(out.detail.after).toEqual([0, 0, 0]);
    s = out.state;
    // Step 2: written out by hand.
    out = agentStep(s, [1, 0, 0], 1, rng);
    const d = out.detail;
    const rbar = (s.baseline + d.reward) / 2;
    close(d.baseline!, rbar);
    const pi = softmax(d.before);
    d.after.forEach((h, b) => close(h, b === d.action ? d.before[b] + 0.1 * (d.reward - rbar) * (1 - pi[b]) : d.before[b] - 0.1 * (d.reward - rbar) * pi[b]));
    // Without a baseline the difference is Rₜ itself.
    const nb = agentStep(newAgent({ kind: "gradient", alpha: 0.1, baseline: false }, 3), [1, 0, 0], 1, makeRng(12));
    expect(nb.detail.baseline).toBe(0);
    close(nb.detail.after[nb.detail.action], 0.1 * nb.detail.reward * (1 - 1 / 3));
  });
  test("the gradient-bandit update equals the gradient of E[Rₜ] in expectation (§2.7, eq. 2.11)", () => {
    const h = [0.4, -0.3, 1.0];
    const qv = [1.5, 0.2, -0.7];
    const pi = softmax(h);
    const b0 = 0.8; // any baseline that does not depend on the action
    for (let a = 0; a < 3; a++) {
      // E over Aₜ ~ π of α (q(Aₜ) − b0)(1{a = Aₜ} − π(a)), against a finite-difference ∂E[R]/∂H(a).
      const expected = pi.reduce((t, p, b) => t + p * (qv[b] - b0) * ((a === b ? 1 : 0) - pi[a]), 0);
      const eps = 1e-6;
      const er = (hh: number[]) => softmax(hh).reduce((t, p, b) => t + p * qv[b], 0);
      const grad = (er(h.map((x, i) => (i === a ? x + eps : x))) - er(h.map((x, i) => (i === a ? x - eps : x)))) / (2 * eps);
      close(expected, grad, 1e-8);
    }
  });
});

describe("experiments", () => {
  const ms: Method[] = [{ kind: "epsilon-greedy", epsilon: 0.1, q1: 0, step: SA }, { kind: "gradient", alpha: 0.1, baseline: true }];
  test("the same seed gives the same curves, whatever the block size", () => {
    const a = runExperiment(TESTBED_10, ms, 10, 100, 3);
    const b = finishCurves(runBlock(TESTBED_10, ms, 100, 3, 5, 10, runBlock(TESTBED_10, ms, 100, 3, 0, 5)), 10);
    a.forEach((c, i) => {
      expect(Array.from(c.avgReward)).toEqual(Array.from(b[i].avgReward));
      expect(Array.from(c.pctOptimal)).toEqual(Array.from(b[i].pctOptimal));
    });
    expect(Array.from(runExperiment(TESTBED_10, ms, 10, 100, 4)[0].avgReward)).not.toEqual(Array.from(a[0].avgReward));
  });
  test("every method faces the same problems in a run", () => {
    const r0 = recordRun(TESTBED_10, ms[0], 5, 3, 2, 0);
    const r1 = recordRun(TESTBED_10, ms[1], 5, 3, 2, 1);
    expect(r0.q).toEqual(r1.q);
  });
  test("% optimal lies in [0, 1] and greedy with σ = 0 locks onto its first choice", () => {
    const tb = { ...TESTBED_10, rewardSd: 0 };
    const [c] = runExperiment(tb, [{ kind: "epsilon-greedy", epsilon: 0, q1: 0, step: SA }], 50, 50, 1);
    expect(Array.from(c.pctOptimal).every((x) => x >= 0 && x <= 1)).toBe(true);
    const run = recordRun(tb, { kind: "epsilon-greedy", epsilon: 0, q1: 0, step: SA }, 50, 2);
    const later = new Set(run.details.slice(10).map((d) => d.action));
    expect(later.size).toBe(1); // with no noise and no exploration, greedy never changes its mind once it has a positive estimate
  });
});

describe("MDP quantities (3.7)–(3.9) on the recycling robot (Table 3.1)", () => {
  const p = { alpha: 0.7, beta: 0.4, rSearch: 3, rWait: 1 };
  const m = recyclingRobot(p);
  const [HIGH, LOW] = [0, 1];
  const [SEARCH, WAIT, RECHARGE] = [0, 1, 2];
  test("transition probabilities and expected rewards match the table", () => {
    close(transitionProb(m, HIGH, SEARCH, HIGH), p.alpha);
    close(transitionProb(m, HIGH, SEARCH, LOW), 1 - p.alpha);
    close(transitionProb(m, LOW, SEARCH, HIGH), 1 - p.beta);
    close(transitionProb(m, LOW, RECHARGE, HIGH), 1);
    close(expectedReward(m, HIGH, SEARCH), p.rSearch);
    close(expectedReward(m, LOW, SEARCH), (1 - p.beta) * -3 + p.beta * p.rSearch);
    close(expectedRewardGivenNext(m, LOW, SEARCH, HIGH)!, -3);
    expect(expectedRewardGivenNext(m, HIGH, WAIT, LOW)).toBeUndefined(); // p = 0
    expect(m.dynamics[HIGH][RECHARGE]).toEqual([]); // not in A(high)
  });
  test("the exact solution agrees with a closed form: always waiting gives v = r_wait / (1 − γ)", () => {
    const v = solveExact(m, [[0, 1, 0], [0, 1, 0]], 0.9)!;
    close(v[HIGH], 10, 1e-9);
    close(v[LOW], 10, 1e-9);
  });
  test("γ = 1 with no terminal state has no solution", () => {
    expect(solveExact(m, recyclingRandomPolicy(), 1)).toBeNull();
  });
});

describe("exact solution and backup terms", () => {
  test("the gridworld's exact v_π is the k = ∞ grid of Figure 4.2", () => {
    const g = gridworld4x4();
    expect(toCells(solveExact(g, equiprobablePolicy(g), 1)!).map((x) => Math.round(x * 1e9) / 1e9)).toEqual([0, -14, -20, -22, -14, -18, -20, -20, -20, -20, -18, -14, -22, -20, -14, 0]);
  });
  test("the terms of (3.12) add up to the backup, split into reward and future parts", () => {
    const m = recyclingRobot({ alpha: 0.6, beta: 0.3, rSearch: 2, rWait: 0.5 });
    const pi = recyclingRandomPolicy();
    const v = [3.1, -1.7];
    for (const s of [0, 1]) {
      const b = backupTerms(m, v, pi, s, 0.8);
      close(b.total, bellmanExpectationBackup(m, v, pi, s, 0.8), 1e-12);
      close(b.reward + b.future, b.total);
      close(b.terms.reduce((t, x) => t + x.weight, 0), 1, 1e-12); // the weights π·p form a distribution
    }
  });
});

describe("the MDP editor's checks", () => {
  test("the presets are valid", () => {
    expect(checkSpec(recyclingSpec())).toEqual([]);
    expect(checkSpec(gridworldSpec())).toEqual([]);
    expect(checkSpec(blankSpec())).toEqual([]);
  });
  test("a row that does not sum to 1, a probability outside [0, 1], or a policy on an unavailable action is refused", () => {
    let s = recyclingSpec();
    s = setOutcomes(s, 0, 0, [{ next: 0, reward: 2, prob: 0.9 }, { next: 1, reward: 2, prob: 0.2 }]);
    expect(checkSpec(s).map((p) => p.message)).toEqual(expect.arrayContaining([expect.stringMatching(/sum to 1\.1, not 1/)]));
    s = setOutcomes(recyclingSpec(), 0, 0, [{ next: 0, reward: 2, prob: 1.5 }, { next: 1, reward: 2, prob: -0.5 }]);
    expect(checkSpec(s).some((p) => /probabilities lie in \[0, 1\]/.test(p.message))).toBe(true);
    s = setPolicy(setPolicy(recyclingSpec(), 0, 2, 0.5), 0, 0, 0);
    expect(checkSpec(s).some((p) => /recharge is not available in high/.test(p.message))).toBe(true);
  });
  test("fractions like 1/3 pass within the tolerance; names must differ; γ must lie in [0, 1]", () => {
    expect(checkSpec(recyclingSpec()).length).toBe(0); // its low-state policy is 1/3 each
    expect(checkSpec({ ...blankSpec(), states: [{ name: "A", terminal: false }, { name: "A", terminal: true }] }).some((p) => /different/.test(p.message))).toBe(true);
    expect(checkSpec({ ...blankSpec(), gamma: 1.2 }).some((p) => /γ/.test(p.message))).toBe(true);
  });
  test("a nonterminal state needs an available action; removing a state removes the arrows into it", () => {
    const s = setOutcomes(setOutcomes(blankSpec(), 0, 0, []), 0, 1, []);
    expect(checkSpec(s).some((p) => /no available action/.test(p.message))).toBe(true);
    const added = addState(blankSpec());
    expect(added.states).toHaveLength(3);
    const removed = removeState(added, 1);
    expect(removed.outcomes[0][0]).toEqual([]); // A's "go" led to T, which was removed
    expect(removed.outcomes[1][0][0].next).toBe(1); // S3 now has index 1 and still loops to itself
  });
  test("a valid spec converts to the MDP lib/rl computes with, and back", () => {
    const { mdp, pi } = toMdp(recyclingSpec());
    const v = solveExact(mdp, pi, 0.9)!;
    const it = iterativePolicyEvaluation(mdp, pi, 0.9, { theta: 1e-12 }).v;
    v.forEach((x, i) => close(x, it[i], 1e-8));
    expect(uniformPolicy(recyclingSpec())[0]).toEqual([0.5, 0.5, 0]);
  });
});
