// Automated checks that back every "computed" verification and every example fact in content/.
// A fact check returns true when the source's claim is reproduced by our implementation.
// An answer check returns the numbers a question's answer key must equal (within the part's tolerance).
// Printed values below are transcribed from page images of the April 2015 draft and cite their page.
import { constantStepEstimates, epsilonGreedyProbabilities, incrementalAverages, recencyWeightedAverage, recencyWeights, ucbScores, argmaxAll } from "../lib/rl/bandit";
import { iterativePolicyEvaluation } from "../lib/rl/dp";
import { constantRewardReturn, discountedReturn, returnsOfEpisode } from "../lib/rl/returns";
import { actionValue, bellmanExpectationBackup, bellmanResidual, equiprobablePolicy, greedyActions, type FiniteMDP } from "../lib/rl/mdp";
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
  "ch02-q009": {
    kind: "answer", // 10 arms, ε = 0.1, one strictly greedy arm: 0.9 + 0.1/10. The draft states the 91% ceiling (p. 36).
    run: () => [epsilonGreedyProbabilities([0, 0, 0, 0.7, 0, 0, 0, 0, 0, 0], 0.1)[3]],
  },
  "ch02-q012": {
    kind: "answer", // arm 1 receives 1, 2, 0 and arm 2 receives 3; estimates by (2.3) from Q_1 = 0; greedy arm (1-based)
    run: () => {
      const q = [incrementalAverages([1, 2, 0], 0).at(-1)!, incrementalAverages([3], 0).at(-1)!];
      const best = argmaxAll(q);
      return [...q, best.length === 1 ? best[0] + 1 : NaN];
    },
  },
  "ch02-q013.programs": {
    kind: "fact", // program A (increment N, then update) equals the sample average; program B (update, then increment) divides by zero first
    run: () => {
      const r = [4, -2, 7, 1, 0];
      let qa = 0, na = 0, qb = 0, nb = 0;
      const outA: number[] = [];
      const outB: number[] = [];
      for (const x of r) {
        na += 1;
        qa += (x - qa) / na;
        outA.push(qa);
        qb += (x - qb) / nb;
        nb += 1;
        outB.push(qb);
      }
      const avg = r.map((_, k) => r.slice(0, k + 1).reduce((s, v) => s + v, 0) / (k + 1));
      return outA.every((v, i) => close(v, avg[i], 1e-12)) && !Number.isFinite(outB[0]);
    },
  },
  "ch02-q016": {
    kind: "answer", // weights in (2.6) for k = 10, α = 0.1: on R_1, α(1−α)^9; on Q_1, (1−α)^10
    run: () => {
      const w = recencyWeights(10, 0.1);
      return [w.rewards[0], w.initial];
    },
  },

  // ----- Chapter 3 -----
  "ch03.bellman-example-state-1": {
    kind: "fact", // the worked example in eq.ch03.bellman-v: successors of state 1 are T, 1, 2, 5 with v_π = 0, −14, −20, −18
    run: () => {
      const v = vPi();
      const succ = grid.actions.map((_, a) => grid.dynamics[1][a][0].next).sort((x, y) => x - y);
      return JSON.stringify(succ) === "[0,1,2,5]" && close(v[1], -14, 1e-6) && close(v[2], -20, 1e-6) && close(v[5], -18, 1e-6) && close(-1 + (0 - 14 - 20 - 18) / 4, -14);
    },
  },

  "ch03-q001": { kind: "answer", run: () => returnsOfEpisode([1, 0, 2], 0.9).slice(0, 2) }, // G_t, G_{t+1}
  "ch03-q002": {
    kind: "answer", // +1 forever with γ = 0.9: the closed form, cross-checked against a long partial sum
    run: () => {
      const closed = constantRewardReturn(1, 0.9);
      const partial = discountedReturn(new Array(2000).fill(1), 0.9);
      return Math.abs(closed - partial) < 1e-9 ? [closed] : [NaN];
    },
  },
  "ch03-q004": {
    kind: "answer", // Exercise 3.9: right-hand side of (3.12) at the centre state of Figure 3.5b from its printed neighbour values
    run: () => {
      // States: 0 = centre, 1–4 = the four neighbours (values from the figure); four deterministic moves, reward 0, γ = 0.9.
      const mdp: FiniteMDP = {
        states: ["centre", "n1", "n2", "n3", "n4"],
        terminal: [false, true, true, true, true], // only the centre is backed up here
        actions: ["north", "south", "east", "west"],
        dynamics: [[1, 2, 3, 4].map((next) => [{ next, reward: 0, prob: 1 }]), [], [], [], []],
      };
      const v = [0.7, 2.3, 0.4, -0.4, 0.7];
      return [bellmanExpectationBackup(mdp, v, equiprobablePolicy(mdp), 0, 0.9)];
    },
  },
  "ch03-q005.constant-shift": {
    kind: "fact", // Exercise 3.10: adding c to every reward of a continuing task adds c/(1−γ) to every state's value
    run: () => {
      // A two-state continuing task with stochastic moves and an arbitrary policy.
      const make = (c: number): FiniteMDP => ({
        states: ["a", "b"],
        terminal: [false, false],
        actions: ["stay", "switch"],
        dynamics: [
          [[{ next: 0, reward: 1 + c, prob: 0.7 }, { next: 1, reward: -2 + c, prob: 0.3 }], [{ next: 1, reward: 0.5 + c, prob: 1 }]],
          [[{ next: 1, reward: 3 + c, prob: 1 }], [{ next: 0, reward: -1 + c, prob: 0.4 }, { next: 1, reward: 2 + c, prob: 0.6 }]],
        ],
      });
      const pi = [[0.25, 0.75], [0.6, 0.4]];
      const gamma = 0.9;
      const c = 2.5;
      const v = iterativePolicyEvaluation(make(0), pi, gamma, { theta: 1e-13 }).v;
      const vc = iterativePolicyEvaluation(make(c), pi, gamma, { theta: 1e-13 }).v;
      return v.every((x, s) => close(vc[s] - x, c / (1 - gamma), 1e-8));
    },
  },
  "ch03-q006.v-from-q": {
    kind: "fact", // Exercise 3.12: v_π(s) = Σ_a π(a|s) q_π(s, a), checked at every state of the 4×4 gridworld
    run: () => {
      const v = vPi();
      return grid.states.every((_, s) => grid.terminal[s] || close(v[s], grid.actions.reduce((t, _, a) => t + random[s][a] * actionValue(grid, v, s, a, 1), 0), 1e-9));
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
  "ch04-q004": {
    kind: "answer", // Exercise 4.2: v_π(15) for the extended gridworld, (i) with state 13 unchanged, (ii) with 13's down move going to 15
    run: () => {
      const extended = (thirteenDownTo15: boolean): FiniteMDP => {
        const base = gridworld4x4();
        const down = base.actions.indexOf("down");
        const dynamics = base.dynamics.map((row, s) =>
          row.map((outs, a) => (thirteenDownTo15 && s === 13 && a === down ? [{ next: 15, reward: -1, prob: 1 }] : outs)),
        );
        const to = { up: 13, down: 15, right: 14, left: 12 } as Record<string, number>;
        dynamics.push(base.actions.map((a) => [{ next: to[a], reward: -1, prob: 1 }]));
        return { states: [...base.states, "15"], terminal: [...base.terminal, false], actions: base.actions, dynamics };
      };
      const solve = (m: FiniteMDP) => iterativePolicyEvaluation(m, equiprobablePolicy(m), 1, { theta: 1e-12 }).v[15];
      return [solve(extended(false)), solve(extended(true))];
    },
  },
  "ch04-q005": { kind: "answer", run: () => [vk(3)[1], vk(3)[5]] }, // exact v_3(1), v_3(5); Figure 4.2 prints −2.4 and −2.9

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
