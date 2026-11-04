import { describe, expect, test } from "vitest";
import {
  argmaxAll, constantStepEstimates, epsilonGreedy, epsilonGreedyProbabilities, greedy, incrementalAverages, recencyWeightedAverage,
  recencyWeights, sampleAverage, stepSizeSums, ucbScores, ucbSelect, updateEstimate,
} from "../src/lib/rl/bandit";
import { iterativePolicyEvaluation } from "../src/lib/rl/dp";
import { actionValue, bellmanResidual, checkMDP, equiprobablePolicy, type FiniteMDP } from "../src/lib/rl/mdp";
import { gridworld4x4, toCells } from "../src/lib/rl/envs/gridworld4x4";
import { robbinsMonro } from "../src/lib/rl/sa";
import { makeRng } from "../src/domain/random";

describe("bandits (S&B 2015 Ch 2)", () => {
  test("sample average (2.1) with default for an untried action", () => {
    expect(sampleAverage([1, 0, 2])).toBe(1);
    expect(sampleAverage([], 5)).toBe(5);
  });
  test("general update (2.4)", () => {
    expect(updateEstimate(4, 0.25, 8)).toBe(5);
  });
  test("incremental averages (2.3) equal running means", () => {
    expect(incrementalAverages([6, 2, 4])).toEqual([0, 6, 4, 4]);
  });
  test("constant step size (2.5) rejects α outside (0, 1]", () => {
    expect(() => constantStepEstimates([1], 0)).toThrow();
    expect(() => constantStepEstimates([1], 1.5)).toThrow();
    expect(constantStepEstimates([10, 0], 0.5, 4)).toEqual([4, 7, 3.5]);
  });
  test("recency weights (2.6)", () => {
    expect(recencyWeights(3, 0.5)).toEqual({ initial: 0.125, rewards: [0.125, 0.25, 0.5] });
    expect(recencyWeights(0, 0.3)).toEqual({ initial: 1, rewards: [] });
    expect(recencyWeights(2, 1)).toEqual({ initial: 0, rewards: [0, 1] }); // 0^0 = 1
    expect(recencyWeightedAverage([10, 0], 0.5, 4)).toBeCloseTo(3.5, 12);
  });
  test("argmax keeps ties; greedy breaks them uniformly", () => {
    expect(argmaxAll([1, 3, 3, 0])).toEqual([1, 2]);
    expect(greedy([1, 3, 3, 0])).toBe(1);
    const rng = makeRng(7);
    const picks = new Set(Array.from({ length: 200 }, () => greedy([1, 3, 3, 0], rng)));
    expect(picks).toEqual(new Set([1, 2]));
  });
  test("ε-greedy probabilities sum to 1 and match sampling", () => {
    const q = [0.2, 0.9, 0.9, 0.1];
    const p = epsilonGreedyProbabilities(q, 0.1);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    const rng = makeRng(42);
    const counts = [0, 0, 0, 0];
    const N = 40_000;
    for (let i = 0; i < N; i++) counts[epsilonGreedy(q, 0.1, rng)]++;
    counts.forEach((c, i) => expect(Math.abs(c / N - p[i])).toBeLessThan(0.01));
  });
  test("UCB (2.8): untried arms are maximising; bonus uses ln", () => {
    expect(ucbScores([5, 0], [3, 0], 4, 1)[1]).toBe(Infinity);
    expect(ucbSelect([5, 0], [3, 0], 4, 1)).toBe(1);
    expect(ucbScores([1], [4], Math.E ** 4, 1)[0]).toBeCloseTo(2, 12); // 1 + sqrt(4/4)
    expect(() => ucbScores([1], [1], 0, 1)).toThrow();
  });
  test("step-size partial sums illustrate (2.7)", () => {
    const h = stepSizeSums((k) => 1 / k, 10_000);
    expect(h.sum).toBeGreaterThan(9); // ln(10^4) + γ_E ≈ 9.79, still growing
    expect(h.sumSq).toBeLessThan(Math.PI ** 2 / 6);
  });
});

describe("MDP and DP (S&B 2015 Ch 3–4)", () => {
  const g = gridworld4x4();
  const pi = equiprobablePolicy(g);
  test("the gridworld is a valid MDP with the book's example transitions", () => {
    expect(() => checkMDP(g, pi)).not.toThrow();
    const right = g.actions.indexOf("right");
    expect(g.dynamics[5][right][0].next).toBe(6); // p(6|5,right) = 1
    expect(g.dynamics[7][right][0].next).toBe(7); // p(7|7,right) = 1, off the grid
    expect(g.dynamics[1][g.actions.indexOf("left")][0].next).toBe(0); // into the terminal corner
  });
  test("checkMDP catches probabilities that do not sum to 1", () => {
    const bad: FiniteMDP = { states: ["a"], terminal: [false], actions: ["x"], dynamics: [[[{ next: 0, reward: 0, prob: 0.5 }]]] };
    expect(() => checkMDP(bad)).toThrow(/sums to 0.5/);
  });
  test("two-array evaluation: k = 1 gives −1 everywhere, terminal stays 0", () => {
    const r = iterativePolicyEvaluation(g, pi, 1, { theta: 0, maxSweeps: 1, mode: "two-array" });
    expect(toCells(r.v)).toEqual([0, ...Array(14).fill(-1), 0]);
    expect(r.sweeps).toBe(1);
  });
  test("stops when Δ < θ and records history", () => {
    const r = iterativePolicyEvaluation(g, pi, 1, { theta: 1e-6, record: true });
    expect(r.deltas.at(-1)!).toBeLessThan(1e-6);
    expect(r.deltas.slice(0, -1).every((d) => d >= 1e-6)).toBe(true);
    expect(r.history).toHaveLength(r.sweeps + 1);
    expect(bellmanResidual(g, r.v, pi, 1)).toBeLessThan(1e-5);
  });
  test("q from v: one step of reward plus the next state's value", () => {
    const v = iterativePolicyEvaluation(g, pi, 1, { theta: 1e-12 }).v;
    expect(actionValue(g, v, 7, g.actions.indexOf("down"), 1)).toBeCloseTo(-15, 6);
  });
  test("rejects γ outside [0, 1]", () => {
    expect(() => iterativePolicyEvaluation(g, pi, 1.2)).toThrow();
  });
});

describe("supplementary: Robbins–Monro (Zhao Ch 6)", () => {
  test("toy example of L6 slide 21", () => {
    expect(robbinsMonro((w) => w - 10, 20, () => 0.5, 2)).toEqual([20, 15, 12.5]);
  });
  test("noisy mean estimation converges with a_k = 1/k", () => {
    const rng = makeRng(3);
    const ws = robbinsMonro((w) => w - (5 + (rng() - 0.5) * 4), 0, (k) => 1 / k, 20_000);
    expect(Math.abs(ws.at(-1)! - 5)).toBeLessThan(0.05);
  });
});
