// Automated checks that back every "computed" verification and every example fact in content/.
// A fact check returns true when the source's claim is reproduced by our implementation.
// An answer check returns the numbers a question's answer key must equal (within the part's tolerance).
// Printed values below are transcribed from page images of the April 2015 draft and cite their page.
import { constantStepEstimates, epsilonGreedyProbabilities, incrementalAverages, recencyWeightedAverage, recencyWeights, ucbScores, argmaxAll } from "../lib/rl/bandit";
import { iterativePolicyEvaluation } from "../lib/rl/dp";
import { actionValue, bellmanResidual, equiprobablePolicy, greedyActions } from "../lib/rl/mdp";
import { gridworld4x4, toCells } from "../lib/rl/envs/gridworld4x4";
import { robbinsMonro } from "../lib/rl/sa";
import figuresCh04 from "../../../content/figures/ch04.json";

export type Check = { kind: "fact"; run: () => boolean } | { kind: "answer"; run: () => number[] };


/** Figure 4.2 (printed p. 93, PDF p. 107), as transcribed in content/figures/ch04.json, keyed "1", "2", "3", "10", "inf". */
const fig42 = figuresCh04.find((f) => f.id === "fig.ch04.policy-evaluation-grids")!.spec.grids;
export const FIG_4_2: Record<string, number[]> = Object.fromEntries(
  fig42.filter((g) => g.label !== "k = 0").map((g) => [g.label.replace("k = ", "").replace("∞", "inf"), g.values]),
);

/**
 * One decimal, nearest value, exact halves toward zero. This is the only simple rule we found that reproduces every
 * printed cell of Figure 4.2: −2.875 prints as −2.9 and −8.352 as −8.4 (so not truncation), but the exact tie −1.75
 * prints as −1.7 (so not the usual half-away-from-zero rounding either).
 */
export function roundHalfTowardZero1(x: number): number {
  const scaled = Math.abs(x) * 10;
  const frac = scaled - Math.floor(scaled);
  const mag = Math.abs(frac - 0.5) < 1e-9 ? Math.floor(scaled) : Math.round(scaled);
  return (Math.sign(x) * mag) / 10 || 0;
}
const roundHalfAway1 = (x: number): number => Number(x.toFixed(1));
const truncate1 = (x: number): number => Math.trunc(x * 10) / 10;

const grid = gridworld4x4();
const random = equiprobablePolicy(grid);
const vk = (k: number) => toCells(iterativePolicyEvaluation(grid, random, 1, { theta: 0, maxSweeps: k, mode: "two-array" }).v);
const vPi = () => iterativePolicyEvaluation(grid, random, 1, { theta: 1e-12 }).v;
const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;

export const CHECKS: Record<string, Check> = {
  // ----- Chapter 2 -----
  "ch02.incremental-q2-equals-r1": {
    kind: "fact", // "which holds even for k = 1, obtaining Q2 = R1 for arbitrary Q1" (p. 37)
    run: () => [-7, 0, 3.5, 100].every((q1) => close(incrementalAverages([4.2, 1, 9], q1)[1], 4.2, 1e-12)),
  },
  "ch02.incremental-equals-sample-average": {
    kind: "fact", // (2.3) reproduces (2.1)
    run: () => {
      const r = [2, -1, 0.5, 4, 3, 3, -2];
      const qs = incrementalAverages(r, 10);
      return r.every((_, k) => close(qs[k + 1], r.slice(0, k + 1).reduce((s, x) => s + x, 0) / (k + 1)));
    },
  },
  "ch02.recency-weights-sum-to-one": {
    kind: "fact", // "the sum of the weights is (1−α)^k + Σ α(1−α)^{k−i} = 1" (p. 38)
    run: () =>
      [0.05, 0.1, 0.5, 0.9, 1].every((a) =>
        [0, 1, 2, 7, 30].every((k) => {
          const w = recencyWeights(k, a);
          return close(w.initial + w.rewards.reduce((s, x) => s + x, 0), 1, 1e-12);
        }),
      ),
  },
  "ch02.recursion-matches-closed-form": {
    kind: "fact", // (2.5) unrolled equals (2.6)
    run: () => {
      const r = [1, 0, 2, 5, -1, 3];
      return [0.1, 0.3, 1].every((a) => close(constantStepEstimates(r, a, 2).at(-1)!, recencyWeightedAverage(r, a, 2), 1e-12));
    },
  },
  "ch02.alpha-one-keeps-last-reward": {
    kind: "fact", // "If 1 − α = 0, then all the weight goes on the very last reward" (p. 39)
    run: () => constantStepEstimates([3, 8, -2], 1, 50).at(-1) === -2,
  },
  "ch02-q001": { kind: "answer", run: () => incrementalAverages([6, 2, 4], 0).slice(1) }, // Q2, Q3, Q4
  "ch02-q002": { kind: "answer", run: () => [constantStepEstimates([10, 0], 0.5, 4).at(-1)!] },
  "ch02-q003": {
    kind: "answer", // weights on Q1, R1, R2, R3 for k = 3, α = 0.5
    run: () => {
      const w = recencyWeights(3, 0.5);
      return [w.initial, ...w.rewards];
    },
  },
  "ch02-q004": {
    kind: "answer", // UCB scores and the selected arm (1-based)
    run: () => {
      const s = ucbScores([1.0, 1.5, 0.8], [5, 10, 2], 17, 2);
      return [...s, argmaxAll(s)[0] + 1];
    },
  },
  "ch02-q006": { kind: "answer", run: () => epsilonGreedyProbabilities([0.2, 0.9, 0.9, 0.1], 0.1) },

  // ----- Chapter 3 -----
  "ch03.bellman-example-state-1": {
    kind: "fact", // the worked example in eq.ch03.bellman-v: successors of state 1 are T, 1, 2, 5 with v_π = 0, −14, −20, −18
    run: () => {
      const v = vPi();
      const succ = grid.actions.map((_, a) => grid.dynamics[1][a][0].next).sort((x, y) => x - y);
      return JSON.stringify(succ) === "[0,1,2,5]" && close(v[1], -14, 1e-6) && close(v[2], -20, 1e-6) && close(v[5], -18, 1e-6) && close(-1 + (0 - 14 - 20 - 18) / 4, -14);
    },
  },

  // ----- Chapter 4 -----
  "ch04.fig4-2-two-array-iterates": {
    kind: "fact", // every printed v_k (k = 1, 2, 3, 10) is the two-array iterate (4.5), rounded as roundHalfTowardZero1
    run: () => ["1", "2", "3", "10"].every((k) => vk(Number(k)).every((x, i) => close(roundHalfTowardZero1(x), FIG_4_2[k][i]))),
  },
  "ch04.fig4-2-rounding-quirk": {
    kind: "fact", // supports the figure-rounding flag: neither usual rounding nor truncation reproduces the printed grids
    run: () =>
      vk(2)[1] === -1.75 &&
      FIG_4_2["2"][1] === -1.7 &&
      !["2", "3"].every((k) => vk(Number(k)).every((x, i) => close(roundHalfAway1(x), FIG_4_2[k][i]))) &&
      !["3", "10"].every((k) => vk(Number(k)).every((x, i) => close(truncate1(x), FIG_4_2[k][i]))),
  },
  "ch04.fig4-2-v-pi": {
    kind: "fact", // k = ∞ column: v_π is exactly the printed integers
    run: () => toCells(vPi()).every((x, i) => close(x, FIG_4_2.inf[i], 1e-6)),
  },
  "ch04.v-pi-satisfies-bellman": {
    kind: "fact", // (4.4): v_π is a fixed point of the backup
    run: () => bellmanResidual(grid, vPi(), random, 1) < 1e-9,
  },
  "ch04.greedy-optimal-from-k3": {
    kind: "fact", // Fig. 4.2 caption: the greedy policies from the third iteration on are optimal (equal to greedy w.r.t. v_π)
    run: () => {
      const ref = JSON.stringify(greedyActions(grid, vPi(), 1, 1e-6));
      return [3, 10].every((k) => JSON.stringify(greedyActions(grid, iterativePolicyEvaluation(grid, random, 1, { theta: 0, maxSweeps: k, mode: "two-array" }).v, 1, 1e-6)) === ref);
    },
  },
  "ch04.in-place-converges-to-same-v": {
    kind: "fact", // p. 91: the in-place version also converges to v_π
    run: () => {
      const twoArray = iterativePolicyEvaluation(grid, random, 1, { theta: 1e-12, mode: "two-array" });
      const inPlace = iterativePolicyEvaluation(grid, random, 1, { theta: 1e-12, mode: "in-place" });
      return inPlace.v.every((x, i) => close(x, twoArray.v[i], 1e-6)) && inPlace.sweeps < twoArray.sweeps;
    },
  },
  "ch04-q001": {
    kind: "answer", // Exercise 4.1: q_π(11, down) and q_π(7, down) under the equiprobable random policy
    run: () => {
      const v = vPi();
      const down = grid.actions.indexOf("down");
      return [actionValue(grid, v, 11, down, 1), actionValue(grid, v, 7, down, 1)];
    },
  },
  "ch04-q002": { kind: "answer", run: () => [vk(2)[1], vk(2)[6]] }, // exact v_2(1), v_2(6)

  // ----- Supplementary: Zhao Chapter 6 (stochastic approximation) -----
  "sup-zhao-06.mean-estimation-is-rm": {
    kind: "fact", // with g̃(w, x) = w − x and a_k = 1/k, Robbins–Monro reproduces the incremental average (2.3) of the core text
    run: () => {
      const x = [3, -1, 4, 1, 5, 9, 2, 6];
      const rm = robbinsMonro((w, k) => w - x[k - 1], 0, (k) => 1 / k, x.length);
      const inc = incrementalAverages(x, 0);
      return rm.every((w, i) => close(w, inc[i], 1e-12));
    },
  },
  "sup-zhao-06-q001": { kind: "answer", run: () => robbinsMonro((w) => w - 10, 20, () => 0.5, 3).slice(1) }, // w2, w3, w4
};

export const checkIds = (): Set<string> => new Set(Object.keys(CHECKS));
