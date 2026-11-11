// Automated checks that back every "computed" verification and every example fact in content/.
// A fact check returns true when the source's claim is reproduced by our implementation.
// An answer check returns the numbers a question's answer key must equal (within the part's tolerance).
// Printed values below are transcribed from page images of the April 2015 draft and cite their page.
import { constantStepEstimates, epsilonGreedyProbabilities, incrementalAverages, recencyWeightedAverage, recencyWeights, ucbScores, argmaxAll } from "../lib/rl/bandit";
import { deterministic, greedyPolicy, iterativePolicyEvaluation, policyIteration, qFromV, valueIteration } from "../lib/rl/dp";
import { GRID5, RANDOM_WALK_START, RANDOM_WALK_TRUE, cliffWalking, gamblersProblem, gridworld5x5, randomWalk, windyGridworld, windyVariant } from "../lib/rl/envs/examples";
import { batchUpdate, certaintyEquivalence, sampleAverageReturns, type Episode } from "../lib/rl/batch";
import * as ttt from "../lib/rl/envs/tictactoe";
import * as tr from "../lib/rl/traces";
import * as pl from "../lib/rl/planning";
import * as ap from "../lib/rl/approx";
import { mcUpdate, newPrediction, runEs, runMcPrediction } from "../lib/rl/mc";
import { DEAL_STATE as BJ_DEAL, END as BJ_END, HIT as BJ_HIT, STICK as BJ_STICK, bjIndex, bjStartPairs, blackjack, stickOn20 } from "../lib/rl/envs/blackjack";
import { INFINITE_VARIANCE_BEHAVIOUR, INFINITE_VARIANCE_TARGET, importanceRatio, infiniteVarianceMdp, isEstimates, newOffPolicyControl, offPolicyControlEpisode, weightedIncremental } from "../lib/rl/offPolicy";
import { TRACK_LEFT, greedyTrajectory, racetrack } from "../lib/rl/envs/racetrack";
import { generateEpisode } from "../lib/rl/sampling";
import { epsilonGreedyAction, greedyPath, newControl, qLearningStep, rmsError, runControl, runTd0, sarsaStep, td0Update } from "../lib/rl/td";
import { makeRng } from "../domain/random";
import { constantRewardReturn, discountedReturn, returnsOfEpisode } from "../lib/rl/returns";
import { FIG_2_5, TESTBED_10, expectedMaxNormal, meanOver, parameterStudy, recordRun, runExperiment, softmax, type Method } from "../lib/rl/banditLab";
import { recyclingRandomPolicy, recyclingRobot } from "../lib/rl/envs/recycling";
import { JACK_EXAMPLE, JACK_EXERCISE_4_5, jackModel, jackPolicyIteration, locationTable } from "../lib/rl/envs/jacksCarRental";
import { actionValue, backupTerms, bellmanExpectationBackup, bellmanResidual, equiprobablePolicy, expectedReward, expectedRewardGivenNext, greedyActions, solveExact, transitionProb, type FiniteMDP } from "../lib/rl/mdp";
import { gridworld4x4, toCells } from "../lib/rl/envs/gridworld4x4";
import { robbinsMonro } from "../lib/rl/sa";
import figuresCh04 from "../../../content/figures/ch04.json";
import figuresCh03 from "../../../content/figures/ch03.json";

export type Check = { kind: "fact"; run: () => boolean } | { kind: "answer"; run: () => number[] };

/** Figure 3.5b, row by row from the top (PDF p. 87): v_π of the equiprobable random policy, to one decimal (content/figures/ch03.json). */
const figure3 = (id: string) => (figuresCh03 as { id: string; spec: { grids: { values: number[] }[] } }[]).find((f) => f.id === id)!.spec.grids[0].values;
const FIG_3_5B = figure3("fig.ch03.gridworld-random-values");
/** Figure 3.8b (PDF p. 93): v_*, to one decimal (content/figures/ch03.json). */
const FIG_3_8B = figure3("fig.ch03.gridworld-optimal-values");
/** Figure 3.8c (PDF p. 93, read at 300 dpi): the arrows in each cell, as N, S, E, W. */
const FIG_3_8C = ["E", "NSEW", "W", "NSEW", "W", "NE", "N", "NW", "W", "W", "NE", "N", "NW", "NW", "NW", "NE", "N", "NW", "NW", "NW", "NE", "N", "NW", "NW", "NW"];


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
const sa = { kind: "sample-average" } as const;
const eg = (epsilon: number): Method => ({ kind: "epsilon-greedy", epsilon, q1: 0, step: sa });
const gr = (alpha: number, baseline: boolean): Method => ({ kind: "gradient", alpha, baseline });

/** One Sarsa or Q-learning update for the transition Q(S, A) = −2, R = −1, Q(S′, ·) = (−1, −3), α = 0.5, with a seed
 *  under which the ε-greedy (ε = 1) next action is the worse one (Q = −3). */
function oneTransition(method: "sarsa" | "q-learning", gamma: number) {
  const m: FiniteMDP = {
    states: ["S", "S'", "T"],
    terminal: [false, false, true],
    actions: ["a", "b"],
    dynamics: [[[{ next: 1, reward: -1, prob: 1 }], [{ next: 1, reward: -1, prob: 1 }]], [[{ next: 2, reward: 0, prob: 1 }], [{ next: 2, reward: 0, prob: 1 }]], [[], []]],
  };
  const st = { ...newControl(m, 0), Q: [[-2, -2], [-1, -3], [0, 0]] };
  const cfg = { method, alpha: 0.5, epsilon: 1, gamma };
  for (let seed = 1; seed < 200; seed++) {
    const s = sarsaStep(m, st, { ...cfg, method: "sarsa" }, makeRng(seed), 0);
    if (s.detail.nextAction !== 1) continue;
    return method === "sarsa" ? s.detail : qLearningStep(m, st, cfg, makeRng(seed), 0).detail;
  }
  throw new Error("no seed picks the worse next action");
}


// ----- Chapter 5 helpers (Milestone 4F) -----
/** Example 5.4's state and policies: dealer 2, sum 13, usable ace; target sticks on 20 or 21; behaviour 50/50. */
const BJ_EX54 = () => {
  const m = blackjack();
  const target = stickOn20();
  const behaviour = target.map((row, i) => (i === BJ_DEAL || i === BJ_END ? row : [0.5, 0.5, 0]));
  return { m, target, behaviour, s: bjIndex(13, 2, true) };
};
/** E_µ[(ρG)^k] from state s for a deterministic target in the blackjack model, by recursion: k = 1 or 2. */
function bjIsMoment(m: FiniteMDP, target: number[][], s: number, k: 1 | 2, memo = new Map<number, number>()): number {
  if (memo.has(s)) return memo.get(s)!;
  const a = target[s][BJ_STICK] === 1 ? BJ_STICK : BJ_HIT;
  // µ picks a with probability 1/2, so each decision contributes (π/µ)^k · µ = 2^k · 1/2 = 2^(k−1).
  let x = 0;
  for (const o of m.dynamics[s][a]) x += o.prob * (o.next === BJ_END ? o.reward ** k : bjIsMoment(m, target, o.next, k, memo));
  x *= 2 ** (k - 1);
  memo.set(s, x);
  return x;
}

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
  // ----- Chapter 2, Milestone 4C -----
  "ch02.softmax-derivative": {
    kind: "fact", // ∂π(b)/∂H(a) = π(b)(1[a=b] − π(a)) (p. 46), against central finite differences of the soft-max
    run: () => {
      const rng = makeRng(42);
      for (let trial = 0; trial < 20; trial++) {
        const n = 2 + Math.floor(rng() * 5);
        const h = Array.from({ length: n }, () => 4 * rng() - 2);
        const pi = softmax(h);
        for (let a = 0; a < n; a++) {
          const up = softmax(h.map((x, i) => (i === a ? x + 1e-6 : x)));
          const dn = softmax(h.map((x, i) => (i === a ? x - 1e-6 : x)));
          for (let b = 0; b < n; b++) if (!close((up[b] - dn[b]) / 2e-6, pi[b] * ((a === b ? 1 : 0) - pi[a]), 1e-7)) return false;
        }
      }
      return true;
    },
  },
  "ch02.gradient-update-unified": {
    kind: "fact", // H(a) += α(R − R̄)(1[a=A] − π(a)) for all a equals the two cases of (2.10)
    run: () => {
      const rng = makeRng(43);
      for (let trial = 0; trial < 50; trial++) {
        const n = 2 + Math.floor(rng() * 5);
        const h = Array.from({ length: n }, () => 4 * rng() - 2);
        const pi = softmax(h);
        const A = Math.floor(rng() * n);
        const [alpha, r, rbar] = [rng(), 4 * rng() - 2, 4 * rng() - 2];
        const twoCases = h.map((x, a) => (a === A ? x + alpha * (r - rbar) * (1 - pi[A]) : x - alpha * (r - rbar) * pi[a]));
        const unified = h.map((x, a) => x + alpha * (r - rbar) * ((a === A ? 1 : 0) - pi[a]));
        if (!twoCases.every((v, i) => close(v, unified[i], 1e-12))) return false;
      }
      return true;
    },
  },
  "ch02.expected-update-is-gradient": {
    kind: "fact", // §2.7: the expected step E[(R − X)(1[a=A] − π(a))] equals ∂E[R]/∂H(a) for ANY action-independent X (here 0, 1000 and E[R])
    run: () => {
      const rng = makeRng(44);
      for (let trial = 0; trial < 20; trial++) {
        const n = 2 + Math.floor(rng() * 5);
        const h = Array.from({ length: n }, () => 4 * rng() - 2);
        const q = Array.from({ length: n }, () => 4 * rng() - 2);
        const pi = softmax(h);
        const er = (hh: number[]) => softmax(hh).reduce((s, p, b) => s + p * q[b], 0);
        for (const X of [0, 1000, er(h)])
          for (let a = 0; a < n; a++) {
            // E over A ~ π and R with E[R | A] = q(A): Σ_b π(b)(q(b) − X)(1[a=b] − π(a))
            const expected = pi.reduce((s, p, b) => s + p * (q[b] - X) * ((a === b ? 1 : 0) - pi[a]), 0);
            const grad = (er(h.map((x, i) => (i === a ? x + 1e-6 : x))) - er(h.map((x, i) => (i === a ? x - 1e-6 : x)))) / 2e-6;
            if (!close(expected, grad, 1e-6)) return false;
          }
      }
      return true;
    },
  },
  "ch02-q023": {
    kind: "answer", // Exercise 2.1, long run: P(optimal) = 1 − ε + ε/10; reward = (1 − ε)·E[max q] + ε·E[mean q], E[mean q] = 0
    run: () => {
      const m = expectedMaxNormal(10);
      return [1 - 0.01 + 0.01 / 10, 1 - 0.1 + 0.1 / 10, 0.99 * m, 0.9 * m];
    },
  },
  "ch02-q028": {
    kind: "answer", // Exercise 2.3's weights for α = (1/2, 1/4, 1/5), found by running the recursion on unit inputs
    run: () => {
      const alphas = [1 / 2, 1 / 4, 1 / 5];
      const run = (q1: number, r: number[]) => r.reduce((q, rk, k) => q + alphas[k] * (rk - q), q1);
      const basis = [run(1, [0, 0, 0]), run(0, [1, 0, 0]), run(0, [0, 1, 0]), run(0, [0, 0, 1])];
      // the closed form of the solution, ∏(1 − α_j) and α_i ∏_{j>i}(1 − α_j), must agree with the recursion
      const closed = [0.5 * 0.75 * 0.8, 0.5 * 0.75 * 0.8, 0.25 * 0.8, 0.2];
      return basis.every((w, i) => close(w, closed[i], 1e-12)) ? basis : [NaN, NaN, NaN, NaN];
    },
  },
  "ch02-q030": {
    kind: "answer", // optimistic start Q_1 = 5, α = 0.1, rewards 1.0 and 0.6; weight (1 − α)^10 on Q_1 after ten rewards
    run: () => {
      const q = constantStepEstimates([1.0, 0.6], 0.1, 5);
      return [q[1], q[2], recencyWeights(10, 0.1).initial];
    },
  },
  "ch02-q034": { kind: "answer", run: () => [100, 1000].map((t) => ucbScores([0], [20], t, 2)[0]) }, // the bonus c√(ln t / N) with Q = 0
  "ch02-q035": {
    kind: "answer", // ∂π(2)/∂H(2) and ∂π(1)/∂H(2) at H = (0, ln 2, 0), by finite differences of the soft-max
    run: () => {
      const d = (b: number) => (softmax([0, Math.log(2) + 1e-7, 0])[b] - softmax([0, Math.log(2) - 1e-7, 0])[b]) / 2e-7;
      return [d(1), d(0)];
    },
  },
  "ch02-q037": {
    kind: "answer", // E[R] = Σ π q and its derivative in H(2), by finite differences, for q = (1, 2, 0), H = (0, ln 2, 0)
    run: () => {
      const q = [1, 2, 0];
      const er = (h2: number) => softmax([0, h2, 0]).reduce((s, p, b) => s + p * q[b], 0);
      return [er(Math.log(2)), (er(Math.log(2) + 1e-7) - er(Math.log(2) - 1e-7)) / 2e-7];
    },
  },
  "ch02-q040": {
    kind: "answer", // Exercise 2.6: best expected reward without and with knowing the case
    run: () => {
      const cases = [[0.1, 0.2], [0.9, 0.8]]; // case A, case B, each with probability 0.5
      const blind = Math.max(...[0, 1].map((a) => 0.5 * cases[0][a] + 0.5 * cases[1][a])); // one action for both cases (mixing cannot beat the best)
      const told = 0.5 * Math.max(...cases[0]) + 0.5 * Math.max(...cases[1]);
      return [blind, told];
    },
  },
  "ch02-q043": {
    kind: "answer", // Bayesian look-ahead tree: 2 actions × 2 rewards per play
    run: () => [(2 * 2) ** 3, 1000 * Math.log2(2 * 2)],
  },

  // ----- Chapter 3 -----
  // Milestone 4D. Figures 3.5b, 3.8b and 3.8c were transcribed from the page images (PDF pp. 87 and 93).
  "ch03.fig3-5-values": {
    kind: "fact", // Figure 3.5b: v_π of the equiprobable random policy, γ = 0.9, solved exactly from (3.12); every printed cell within 0.05
    run: () => {
      const g = gridworld5x5();
      const v = solveExact(g, equiprobablePolicy(g), 0.9)!;
      return FIG_3_5B.every((x, i) => Math.abs(v[i] - x) <= 0.05 + 1e-9);
    },
  },
  "ch03.fig3-5-a-and-b": {
    kind: "fact", // p. 73: A is the best state but worth less than its +10; B is worth more than its +5
    run: () => {
      const g = gridworld5x5();
      const v = solveExact(g, equiprobablePolicy(g), 0.9)!;
      return Math.max(...v) === v[GRID5.A] && v[GRID5.A] < 10 && v[GRID5.B] > 5 && v[GRID5.B2] > 0 && v[GRID5.A2] < 0;
    },
  },
  "ch03.fig3-8-values": {
    kind: "fact", // Figure 3.8b: v_* by solving (3.17) (value iteration to 1e−12); every printed cell within 0.05
    run: () => {
      const v = valueIteration(gridworld5x5(), 0.9, { theta: 1e-12 }).v;
      return FIG_3_8B.every((x, i) => Math.abs(v[i] - x) <= 0.05 + 1e-9);
    },
  },
  "ch03.fig3-8-policy": {
    kind: "fact", // Figure 3.8c: the set of optimal actions in every cell (all ties) equals the arrows printed
    run: () => {
      const g = gridworld5x5();
      const ties = greedyPolicy(g, valueIteration(g, 0.9, { theta: 1e-12 }).v, 0.9, undefined, 1e-6).ties;
      const name = (as: number[]) => as.map((a) => "NSEW"[a]).sort().join("");
      return FIG_3_8C.every((cell, s) => name(ties[s]) === cell.split("").sort().join(""));
    },
  },
  "ch03.recycling-optimality-forms": {
    kind: "fact", // Example 3.11 (p. 78): v_* of the recycling robot satisfies the two explicit equations printed there, for random α, β, r_s > r_w, γ < 1
    run: () => {
      const rng = makeRng(31);
      for (let trial = 0; trial < 25; trial++) {
        const [alpha, beta, gamma] = [rng(), rng(), 0.99 * rng()];
        const rw = 3 * rng() - 1;
        const rs = rw + 2 * rng();
        const v = valueIteration(recyclingRobot({ alpha, beta, rSearch: rs, rWait: rw }), gamma, { theta: 1e-13 }).v;
        const [h, l] = v;
        const vh = Math.max(rs + gamma * (alpha * h + (1 - alpha) * l), rw + gamma * h);
        const vl = Math.max(beta * rs - 3 * (1 - beta) + gamma * ((1 - beta) * h + beta * l), rw + gamma * l, gamma * h);
        if (!close(h, vh, 1e-8) || !close(l, vl, 1e-8)) return false;
      }
      return true;
    },
  },
  "ch03.recycling-q-star-forms": {
    kind: "fact", // Exercise 3.16 (our answer): q_* of the recycling robot written out with α, β, r_s, r_w agrees with q_* computed from v_*
    run: () => {
      const rng = makeRng(32);
      for (let trial = 0; trial < 25; trial++) {
        const [alpha, beta, gamma] = [rng(), rng(), 0.99 * rng()];
        const rw = 3 * rng() - 1;
        const rs = rw + 2 * rng();
        const mdp = recyclingRobot({ alpha, beta, rSearch: rs, rWait: rw });
        const q = qFromV(mdp, valueIteration(mdp, gamma, { theta: 1e-13 }).v, gamma);
        const mh = Math.max(q[0][0], q[0][1]);
        const ml = Math.max(q[1][0], q[1][1], q[1][2]);
        const forms = [
          [0, 0, alpha * (rs + gamma * mh) + (1 - alpha) * (rs + gamma * ml)], // q*(h, s)
          [0, 1, rw + gamma * mh], // q*(h, w)
          [1, 0, beta * (rs + gamma * ml) + (1 - beta) * (-3 + gamma * mh)], // q*(l, s)
          [1, 1, rw + gamma * ml], // q*(l, w)
          [1, 2, gamma * mh], // q*(l, re)
        ];
        if (!forms.every(([s, a, x]) => close(q[s][a], x, 1e-8))) return false;
      }
      return true;
    },
  },
  "ch03.bellman-q-pi": {
    kind: "fact", // Exercises 3.8, 3.12, 3.13: v_π = Σ_a π q_π, q_π = Σ p[r + γ v_π], and q_π satisfies its own Bellman equation
    // (q_π(s,a) = Σ p[r + γ Σ_a' π(a'|s') q_π(s',a')]), on the 5×5 gridworld and on the recycling robot, for the random policy
    run: () => {
      const cases: [FiniteMDP, number[][]][] = [
        [gridworld5x5(), equiprobablePolicy(gridworld5x5())],
        [recyclingRobot({ alpha: 0.8, beta: 0.6, rSearch: 2, rWait: 1 }), recyclingRandomPolicy()],
      ];
      return cases.every(([m, pi]) => {
        const v = solveExact(m, pi, 0.9)!;
        const q = qFromV(m, v, 0.9);
        const vFromQ = m.states.every((_, s) => close(v[s], pi[s].reduce((t, p, a) => t + (p ? p * q[s][a] : 0), 0), 1e-9)); // only available actions (π > 0) have a q
        const qRec = m.states.every((_, s) =>
          m.actions.every((_, a) => m.dynamics[s][a].length === 0 || close(q[s][a], m.dynamics[s][a].reduce((t, o) => t + o.prob * (o.reward + 0.9 * pi[o.next].reduce((u, p, b) => u + (p ? p * q[o.next][b] : 0), 0)), 0), 1e-9)),
        );
        return vFromQ && qRec;
      });
    },
  },
  "ch03.optimal-relations": {
    kind: "fact", // Exercises 3.18–3.21 and (3.15): v_* = max_a q_*; q_* = Σ p[r + γ v_*]; q_* satisfies its optimality equation;
    // the policy greedy in q_* is greedy in v_*; and v_* ≥ v_π for the random policy, on the 5×5 gridworld and the recycling robot
    run: () =>
      [gridworld5x5() as FiniteMDP, recyclingRobot({ alpha: 0.8, beta: 0.6, rSearch: 2, rWait: 1 })].every((m) => {
        const vstar = valueIteration(m, 0.9, { theta: 1e-13 }).v;
        const q = qFromV(m, vstar, 0.9);
        const avail = (s: number) => m.actions.map((_, a) => a).filter((a) => m.dynamics[s][a].length > 0);
        const maxQ = (s: number) => Math.max(...avail(s).map((a) => q[s][a]));
        const vIsMaxQ = m.states.every((_, s) => close(vstar[s], maxQ(s), 1e-9));
        const qOpt = m.states.every((_, s) => avail(s).every((a) => close(q[s][a], m.dynamics[s][a].reduce((t, o) => t + o.prob * (o.reward + 0.9 * maxQ(o.next)), 0), 1e-9)));
        const greedyQ = m.states.map((_, s) => avail(s).filter((a) => q[s][a] >= maxQ(s) - 1e-9));
        const sameGreedy = greedyPolicy(m, vstar, 0.9).ties.every((t, s) => t.join() === greedyQ[s].join());
        const pi = m.states.map((_, s) => m.actions.map((_, a) => (avail(s).includes(a) ? 1 / avail(s).length : 0)));
        const dominates = solveExact(m, pi, 0.9)!.every((x, s) => vstar[s] >= x - 1e-9);
        return vIsMaxQ && qOpt && sameGreedy && dominates;
      }),
  },
  "ch03.absorbing-state-return": {
    kind: "fact", // §3.4: with an absorbing state, (3.1) over T = 3 rewards, (3.2) over the infinite sequence and (3.3) agree, for γ = 1 and γ = 0.9
    run: () =>
      [1, 0.9].every((g) => {
        const finite = [1, 1, 1];
        const infinite = [1, 1, 1, ...new Array(200).fill(0)];
        const eq33 = finite.reduce((s, r, k) => s + g ** k * r, 0); // Σ_{k=0}^{T−t−1} γ^k R_{t+k+1}, t = 0, T = 3
        return close(discountedReturn(finite, g), discountedReturn(infinite, g), 1e-12) && close(eq33, discountedReturn(infinite, g), 1e-12) && (g !== 1 || discountedReturn(finite, 1) === 3);
      }),
  },
  "ch03-q011": {
    kind: "answer", // Exercise 3.4, γ = 0.9: episodic with −1 as R_{t+5} → −γ⁴; continuing with a failure every 5 steps → −γ⁴/(1 − γ⁵)
    run: () => {
      const once = [0, 0, 0, 0, -1];
      const forever = Array.from({ length: 2000 }, (_, k) => ((k + 1) % 5 === 0 ? -1 : 0));
      return [discountedReturn(once, 0.9), discountedReturn(forever, 0.9)];
    },
  },
  "ch03-q020": { kind: "answer", run: () => [valueIteration(gridworld5x5(), 0.9, { theta: 1e-13 }).v[GRID5.A]] }, // Exercise 3.17: v_*(A) = 10/(1 − γ⁵)
  "ch03-q029": { kind: "answer", run: () => returnsOfEpisode([1, 1, 1, 0, 0, 0], 0.9).filter((_, i) => i === 0 || i === 1 || i === 3) }, // G_0, G_1, G_3
  "ch03-q033": {
    kind: "answer", // (3.7)–(3.9) on Table 3.1 with β = 0.7, r_search = 2 (α, r_wait do not matter here)
    run: () => {
      const m = recyclingRobot({ alpha: 0.5, beta: 0.7, rSearch: 2, rWait: 1 });
      return [expectedReward(m, 1, 0), transitionProb(m, 1, 0, 0), expectedRewardGivenNext(m, 1, 0, 0)!];
    },
  },
  "ch03-q035": {
    kind: "answer", // Figure 3.5b, exactly: v_π(A) and v_π(B)
    run: () => {
      const g = gridworld5x5();
      const v = solveExact(g, equiprobablePolicy(g), 0.9)!;
      return [v[GRID5.A], v[GRID5.B]];
    },
  },
  "ch03-q037": {
    kind: "answer", // q_*(s, up) and q_*(s, left) in the cell just below B (row 2, column 4 counted from 1), by (3.15)
    run: () => {
      const g = gridworld5x5();
      const q = qFromV(g, valueIteration(g, 0.9, { theta: 1e-13 }).v, 0.9);
      return [q[8][0], q[8][3]];
    },
  },
  "ch03-q038": {
    kind: "answer", // Example 3.11 with sample numbers α = 0.8, β = 0.6, r_s = 2, r_w = 1, γ = 0.9: v_*(high), v_*(low)
    run: () => valueIteration(recyclingRobot({ alpha: 0.8, beta: 0.6, rSearch: 2, rWait: 1 }), 0.9, { theta: 1e-13 }).v,
  },
  "ch03.pole-balancing-returns": {
    kind: "fact", // Example 3.4: episodic, +1 per step without failure → the return is the number of steps before failure;
    // continuing, −1 on failure → with the failure as reward R_{t+K+1} (K steps before it), the return is −γ^K
    run: () => {
      const episodic = [1, 1, 1, 1, 1, 1, 1, 0]; // seven steps balanced, failure reward 0 ends the episode
      const k = 6;
      const continuing = [...new Array(k).fill(0), -1, ...new Array(300).fill(0)];
      return discountedReturn(episodic, 1) === 7 && close(discountedReturn(continuing, 0.9), -(0.9 ** k), 1e-12);
    },
  },
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

  // ----- Laboratories (Milestone 3D): the labs reproduce the draft's own examples -----
  // Simulations use 300 runs (the draft averages 2000) with a fixed seed; thresholds leave room for that noise.
  "lab.bandit.fig2-1": {
    kind: "fact", // p. 36: greedy reaches a reward of only about 1 and finds the optimal action in about one-third of tasks;
    // ε = 0.1 explores more and keeps improving, but never selects the optimal action more than 91% of the time.
    run: () => {
      const [g, e01, e1] = runExperiment(TESTBED_10, [eg(0), eg(0.01), eg(0.1)], 300, 1000, 11).map((c) => ({ r: meanOver(c.avgReward, 900, 1000), o: meanOver(c.pctOptimal, 900, 1000) }));
      return g.r > 0.85 && g.r < 1.2 && g.o > 0.24 && g.o < 0.45 && e1.o > g.o + 0.25 && e1.o < 0.91 + 0.03 && e01.r > g.r && e1.r > g.r;
    },
  },
  "lab.bandit.best-possible": {
    kind: "fact", // p. 36: "the best possible of about 1.55 on this testbed" = E[max of 10 standard normals] = 1.5388
    run: () => Math.abs(expectedMaxNormal(10) - 1.5388) < 0.0005 && Math.abs(expectedMaxNormal(10) - 1.55) < 0.02,
  },
  "lab.bandit.fig2-2": {
    kind: "fact", // Figure 2.2: optimistic greedy (Q_1 = 5) starts worse than realistic ε-greedy (ε = 0.1) and ends better; both α = 0.1
    run: () => {
      const a = { kind: "constant", alpha: 0.1 } as const;
      const [opt, real] = runExperiment(TESTBED_10, [{ kind: "epsilon-greedy", epsilon: 0, q1: 5, step: a }, { kind: "epsilon-greedy", epsilon: 0.1, q1: 0, step: a }], 300, 1000, 12);
      return meanOver(opt.pctOptimal, 0, 50) < meanOver(real.pctOptimal, 0, 50) && meanOver(opt.pctOptimal, 800, 1000) > meanOver(real.pctOptimal, 800, 1000) + 0.04;
    },
  },
  "lab.bandit.fig2-3": {
    kind: "fact", // Figure 2.3: UCB (c = 2) beats ε-greedy (ε = 0.1) after the first steps, with a spike on the 11th play
    run: () => {
      const [ucb, e] = runExperiment(TESTBED_10, [{ kind: "ucb", c: 2, q1: 0, step: sa }, eg(0.1)], 300, 1000, 13);
      return ucb.avgReward[10] > ucb.avgReward[9] + 0.5 && ucb.avgReward[10] > ucb.avgReward[11] && meanOver(ucb.avgReward, 300, 1000) > meanOver(e.avgReward, 300, 1000);
    },
  },
  "lab.bandit.fig2-4": {
    kind: "fact", // Figure 2.4 (testbed mean +4): the gradient bandit with the baseline does much better than without it
    run: () => {
      const tb = { ...TESTBED_10, meanOfMeans: 4 };
      const [w1, w4, n1, n4] = runExperiment(tb, [gr(0.1, true), gr(0.4, true), gr(0.1, false), gr(0.4, false)], 300, 1000, 14).map((c) => meanOver(c.pctOptimal, 800, 1000));
      return w1 > n1 + 0.2 && w4 > n4 + 0.2 && w1 > w4;
    },
  },
  "lab.bandit.step-matches-fast": {
    kind: "fact", // the step inspector and the fast runner make the same choices and rewards on the same seed
    run: () =>
      [eg(0.1), { kind: "ucb", c: 2, q1: 0, step: sa } as Method, gr(0.1, true)].every((m) => {
        const one = runExperiment(TESTBED_10, [m], 1, 200, 21)[0];
        const rec = recordRun(TESTBED_10, m, 200, 21);
        return rec.details.every((d, i) => close(d.reward, one.avgReward[i], 1e-12) && (one.pctOptimal[i] === 1) === (rec.q[d.action] === Math.max(...rec.q)));
      }),
  },
  "lab.bandit.fig2-5": {
    kind: "fact", // Figure 2.5 (p. 48), 300 runs: every curve peaks in the interior, within one doubling of the draft's peak
    // (read from the page image: ε 1/16, α 1/4, c 1/2–1, Q₁ 1); UCB's best is the highest; each method stays within 0.1 of its
    // best over at least three consecutive settings (a factor of 4 or more, "about an order of magnitude" in the draft);
    // the gradient bandit at α = 4 is its worst point. With 2000 runs (measured, Milestone 4C) UCB leads by 0.025.
    run: () => {
      const res = parameterStudy(TESTBED_10, FIG_2_5, 300, 1000, 25);
      const draftPeak: Record<string, number[]> = { "epsilon-greedy": [-4], gradient: [-2], ucb: [-1, 0], optimistic: [0] };
      const bests = res.map((v) => Math.max(...v));
      return FIG_2_5.every((f, i) => {
        const v = res[i];
        const j = v.indexOf(bests[i]);
        const interior = j > 0 && j < v.length - 1;
        const nearDraft = draftPeak[f.key].some((e) => Math.abs(f.exponents[j] - e) <= 1);
        let run = 0;
        let longest = 0;
        for (const x of v) longest = Math.max(longest, (run = x >= bests[i] - 0.1 ? run + 1 : 0));
        return interior && nearDraft && longest >= 3;
      }) && bests[2] === Math.max(...bests) && Math.min(...res[1]) === res[1][res[1].length - 1] && res[1][res[1].length - 1] < bests[1] - 0.3;
    },
  },
  "lab.bandit.ex2-4": {
    kind: "fact", // Exercise 2.4 (lab task): on a random-walk testbed (step sd 0.01, our choice), ε = 0.1 with α = 0.1 beats
    // sample averages over the second half of 10,000 steps, in reward and in % optimal (measured with 500 runs: 1.17 vs 0.94, 74% vs 45%)
    run: () => {
      const tb = { ...TESTBED_10, sdOfMeans: 0, walkSd: 0.01 };
      const [sa, ca] = runExperiment(tb, [eg(0.1), { kind: "epsilon-greedy", epsilon: 0.1, q1: 0, step: { kind: "constant", alpha: 0.1 } }], 100, 10_000, 3);
      return meanOver(ca.avgReward, 5000, 10_000) > meanOver(sa.avgReward, 5000, 10_000) + 0.1 && meanOver(ca.pctOptimal, 5000, 10_000) > meanOver(sa.pctOptimal, 5000, 10_000) + 0.15;
    },
  },
  "lab.bandit.walk-step-matches-fast": {
    kind: "fact", // on the random-walk testbed the inspector and the fast runner still agree step for step; the values start equal and move
    run: () => {
      const tb = { ...TESTBED_10, sdOfMeans: 0, walkSd: 0.01 };
      return [eg(0.1), { kind: "ucb", c: 2, q1: 0, step: sa } as Method, gr(0.1, true)].every((m) => {
        const one = runExperiment(tb, [m], 1, 300, 22)[0];
        const rec = recordRun(tb, m, 300, 22);
        const startEqual = rec.qs[0].every((x) => x === 0);
        const moved = rec.qs[299].some((x) => x !== 0);
        return startEqual && moved && rec.details.every((d, i) => close(d.reward, one.avgReward[i], 1e-12) && (one.pctOptimal[i] === 1) === d.optimal && d.optimal === (rec.qs[i][d.action] === Math.max(...rec.qs[i])));
      });
    },
  },
  "lab.bandit.optimistic-spike": {
    kind: "fact", // Figure 2.2 / Exercise 2.5: optimistic greedy tries each arm once on steps 1–10 (about 10% optimal each), then spikes on step 11
    run: () => {
      const [opt] = runExperiment(TESTBED_10, [{ kind: "epsilon-greedy", epsilon: 0, q1: 5, step: { kind: "constant", alpha: 0.1 } }], 300, 20, 12);
      const first10 = Array.from(opt.pctOptimal.slice(0, 10));
      return first10.every((x) => x > 0.04 && x < 0.17) && opt.pctOptimal[10] > 0.3 && opt.pctOptimal[10] > opt.pctOptimal[12] + 0.15;
    },
  },
  // ----- Chapter 4, Milestone 4E -----
  "ch04.jack-figure-4-4": {
    kind: "fact", // Figure 4.4 (p. 99): policy iteration from "never move" gives π0…π4, π4 stable; moves span −4…5; each step a strict
    // improvement; the top row (20 cars at the first location) and bottom row (0 cars) of π4 equal the figure, read at 500 dpi
    run: () => {
      const r = jackPolicyIteration(JACK_EXAMPLE);
      const pis = r.iterations.map((it) => Array.from(it.policy));
      const pi4 = pis[4];
      const row = (c1: number) => pi4.slice(c1 * 21, c1 * 21 + 21);
      const top = [5, 5, 5, 5, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 0, 0, 0];
      const bottom = [0, 0, 0, 0, 0, 0, 0, 0, -1, -1, -2, -2, -2, -3, -3, -3, -3, -3, -4, -4, -4];
      const improving = r.iterations.every((it, k) => k === 0 || (it.v.every((x, s) => x >= r.iterations[k - 1].v[s] - 1e-6) && it.v.some((x, s) => x > r.iterations[k - 1].v[s] + 1e-3)));
      return r.stable && pis.length === 5 && pis[0].every((a) => a === 0) && Math.min(...pi4) === -4 && Math.max(...pi4) === 5 &&
        row(20).every((a, i) => a === top[i]) && row(0).every((a, i) => a === bottom[i]) && improving;
    },
  },
  "ch04.jack-value-range": {
    kind: "fact", // Figure 4.4's v4 axis is labelled 420 at the bottom; the smallest value of v4 is 421.4 (within 2 of 420)
    run: () => Math.abs(Math.min(...jackPolicyIteration(JACK_EXAMPLE).iterations[4].v) - 420) < 2,
  },
  "ch04.policy-improvement-theorem": {
    kind: "fact", // (4.7)–(4.8): the policy greedy with respect to v_π is at least as good in every state, and strictly better somewhere
    // unless π is already optimal; tested from 30 random deterministic policies on the 5×5 gridworld and the recycling robot
    run: () => {
      const rng = makeRng(41);
      const mdps: FiniteMDP[] = [gridworld5x5(), recyclingRobot({ alpha: 0.8, beta: 0.6, rSearch: 2, rWait: 1 })];
      return mdps.every((m) => {
        const vstar = valueIteration(m, 0.9, { theta: 1e-12 }).v;
        for (let trial = 0; trial < 15; trial++) {
          const acts = m.states.map((_, s) => {
            const av = m.actions.map((_, a) => a).filter((a) => m.dynamics[s][a].length > 0);
            return av[Math.floor(rng() * av.length)];
          });
          const pi = deterministic(m, acts);
          const v = solveExact(m, pi, 0.9)!;
          const greedy = greedyPolicy(m, v, 0.9, acts).actions;
          const q = qFromV(m, v, 0.9);
          if (!m.states.every((_, s) => q[s][greedy[s]] >= v[s] - 1e-9)) return false; // (4.7)
          const v2 = solveExact(m, deterministic(m, greedy), 0.9)!;
          if (!v2.every((x, s) => x >= v[s] - 1e-9)) return false; // (4.8)
          const optimal = v.every((x, s) => close(x, vstar[s], 1e-6));
          if (!optimal && !v2.some((x, s) => x > v[s] + 1e-9)) return false;
        }
        return true;
      });
    },
  },
  "ch04.q-evaluation-converges": {
    kind: "fact", // Exercise 4.3 (our answer): q_{k+1}(s,a) = Σ p[r + γ Σ_a' π(a'|s') q_k(s',a')] converges to q_π, on the 5×5 gridworld
    run: () => {
      const m = gridworld5x5();
      const pi = equiprobablePolicy(m);
      const target = qFromV(m, solveExact(m, pi, 0.9)!, 0.9);
      let q = m.states.map(() => m.actions.map(() => 0));
      for (let k = 0; k < 400; k++) q = m.states.map((_, s) => m.actions.map((_, a) => m.dynamics[s][a].reduce((t, o) => t + o.prob * (o.reward + 0.9 * pi[o.next].reduce((u, p, b) => u + p * q[o.next][b], 0)), 0)));
      return q.every((row, s) => row.every((x, a) => close(x, target[s][a], 1e-9)));
    },
  },
  "ch04.q-value-iteration-converges": {
    kind: "fact", // Exercise 4.10 (our answer): q_{k+1}(s,a) = Σ p[r + γ max_a' q_k(s',a')] converges to q_*, on the 5×5 gridworld
    run: () => {
      const m = gridworld5x5();
      const target = qFromV(m, valueIteration(m, 0.9, { theta: 1e-13 }).v, 0.9);
      let q = m.states.map(() => m.actions.map(() => 0));
      for (let k = 0; k < 400; k++) q = m.states.map((_, s) => m.actions.map((_, a) => m.dynamics[s][a].reduce((t, o) => t + o.prob * (o.reward + 0.9 * Math.max(...q[o.next])), 0)));
      return q.every((row, s) => row.every((x, a) => close(x, target[s][a], 1e-9)));
    },
  },
  "lab.dp.jack-ex4-5": {
    kind: "fact", // Exercise 4.5 (lab task): the variant converges to a stable policy, and the free shuttle and parking costs change it:
    // more states move exactly one car from the first location to the second than in the original problem
    run: () => {
      const orig = jackPolicyIteration(JACK_EXAMPLE).iterations.at(-1)!.policy;
      const r = jackPolicyIteration(JACK_EXERCISE_4_5);
      const pol = r.iterations.at(-1)!.policy;
      const ones = (p: ArrayLike<number>) => Array.from(p).filter((a) => a === 1).length;
      return r.stable && r.iterations.length <= 10 && ones(pol) > ones(orig) && Array.from(pol).some((a, s) => a !== orig[s]);
    },
  },
  "lab.dp.gambler-ex4-9": {
    kind: "fact", // Exercise 4.9 (lab task): p_h = 0.25 → v*(50) = 0.25, v*(25) = 0.0625, stake 50 optimal at 50 (bold play);
    // p_h = 0.55 → a stake of 1 is optimal in every state and v*(50) = (1 − r^50)/(1 − r^100) with r = 0.45/0.55 (timid play)
    run: () => {
      const low = valueIteration(gamblersProblem(0.25), 1, { theta: 1e-12 });
      const high = valueIteration(gamblersProblem(0.55), 1, { theta: 1e-12 });
      const r = 0.45 / 0.55;
      const timid = high.policy.ties.every((t, s) => s === 0 || s === 100 || t.includes(1));
      return close(low.v[50], 0.25, 1e-9) && close(low.v[25], 0.0625, 1e-9) && low.policy.ties[50].includes(50) && timid && close(high.v[50], (1 - r ** 50) / (1 - r ** 100), 1e-6);
    },
  },
  "ch04-q013": {
    kind: "answer", // Example 4.2: one location with 2 cars in the morning and Poisson(3) requests: expected rentals, expected credit
    run: () => {
      const e = locationTable(3, 3, 20).rented[2];
      return [e, 10 * e];
    },
  },
  "ch04-q014": { kind: "answer", run: () => [jackModel(JACK_EXAMPLE).n ** 2, 11] }, // states, actions in the largest A(s)
  "ch04-q015": { kind: "answer", run: () => [4 ** 14] }, // deterministic policies of the 4×4 gridworld: 4 actions in each of 14 states
  "ch04-q017": { kind: "answer", run: () => [1e20 / 1e6 / (365.25 * 24 * 3600)] }, // years for one backgammon sweep at a million backups a second (p. 101)
  "ch04-q016": {
    kind: "answer", // Exercise 4.9 numbers: v*(25) and v*(50) with p_h = 0.25
    run: () => {
      const v = valueIteration(gamblersProblem(0.25), 1, { theta: 1e-12 }).v;
      return [v[25], v[50]];
    },
  },
  // ----- Chapter 5, Milestone 4F -----
  "ch05.fig5-2-accuracy": {
    kind: "fact", // Example 5.1, Figure 5.2: first-visit MC on "stick on 20 or 21" (100,000 games) is close to the exact values,
    // and the usable-ace states, being rarer, are estimated less accurately
    run: () => {
      const m = blackjack();
      const pi = stickOn20();
      const exact = solveExact(m, pi, 1)!;
      const rng = makeRng(52);
      let st = newPrediction(m.states.length);
      for (let e = 0; e < 100_000; e++) st = mcUpdate(st, generateEpisode(m, pi, BJ_DEAL, rng).steps, 1, true).state;
      const rms = (lo: number, hi: number) => Math.sqrt(Array.from({ length: hi - lo + 1 }, (_, i) => (st.V[lo + i] - exact[lo + i]) ** 2).reduce((a, b) => a + b, 0) / (hi - lo + 1));
      const plain = rms(1, 100);
      const usable = rms(101, 200);
      return plain < 0.03 && usable < 0.1 && usable > plain;
    },
  },
  "ch05.blackjack-no-revisits": {
    kind: "fact", // p. 116: a state never recurs within a game, so first-visit and every-visit MC coincide (20,000 sampled games)
    run: () => {
      const m = blackjack();
      const rng = makeRng(53);
      const pi = stickOn20();
      for (let e = 0; e < 20_000; e++) {
        const seen = new Set<number>();
        for (const x of generateEpisode(m, pi, BJ_DEAL, rng).steps) {
          if (seen.has(x.s)) return false;
          seen.add(x.s);
        }
      }
      return true;
    },
  },
  "ch05.soap-bubble": {
    kind: "fact", // Example 5.2: on a 9×9 grid with fixed boundary heights, relaxation (each point the mean of its four neighbours) and the
    // average boundary height reached by random walks from the centre (20,000 walks) agree within 0.02
    run: () => {
      const n = 9;
      const edge = (r: number, c: number) => r === 0 || c === 0 || r === n - 1 || c === n - 1;
      const height = (r: number, c: number) => Math.sin(r) + 0.5 * c; // the wire frame
      let h = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => (edge(r, c) ? height(r, c) : 0)));
      for (let k = 0; k < 2000; k++) h = h.map((row, r) => row.map((x, c) => (edge(r, c) ? x : (h[r - 1][c] + h[r + 1][c] + h[r][c - 1] + h[r][c + 1]) / 4)));
      const rng = makeRng(54);
      let total = 0;
      const walks = 20_000;
      for (let w = 0; w < walks; w++) {
        let r = 4;
        let c = 4;
        while (!edge(r, c)) {
          const d = Math.floor(rng() * 4);
          if (d === 0) r--;
          else if (d === 1) r++;
          else if (d === 2) c--;
          else c++;
        }
        total += height(r, c);
      }
      return Math.abs(total / walks - h[4][4]) < 0.02;
    },
  },
  "ch05.epsilon-greedy-improvement": {
    kind: "fact", // (5.2): for random ε-soft policies π on the 5×5 gridworld, the ε-greedy policy for q_π is at least as good in every state;
    // repeating the step reaches the best ε-soft value ṽ*, the optimum of the environment with ε "moved inside" (p. 126)
    run: () => {
      const m = gridworld5x5();
      const eps = 0.1;
      const nA = m.actions.length;
      const epsGreedy = (q: number[][]) => q.map((row) => {
        const best = row.indexOf(Math.max(...row));
        return row.map((_, a) => eps / nA + (a === best ? 1 - eps : 0));
      });
      const rng = makeRng(55);
      for (let trial = 0; trial < 10; trial++) {
        const pi = m.states.map(() => {
          const raw = m.actions.map(() => rng());
          const sum = raw.reduce((a, b) => a + b, 0);
          return raw.map((x) => eps / nA + ((1 - eps) * x) / sum);
        });
        const v = solveExact(m, pi, 0.9)!;
        const v2 = solveExact(m, epsGreedy(qFromV(m, v, 0.9)), 0.9)!;
        if (!v2.every((x, s) => x >= v[s] - 1e-9)) return false;
      }
      // Iterate to the fixed point and compare with value iteration on the "ε inside" environment.
      let pi = equiprobablePolicy(m);
      for (let k = 0; k < 50; k++) pi = epsGreedy(qFromV(m, solveExact(m, pi, 0.9)!, 0.9));
      const vFix = solveExact(m, pi, 0.9)!;
      const inside: FiniteMDP = { ...m, dynamics: m.dynamics.map((row) => row.map((outs) => [
        ...outs.map((o) => ({ ...o, prob: o.prob * (1 - eps) })),
        ...row.flatMap((o2) => o2.map((o) => ({ ...o, prob: (o.prob * eps) / nA }))),
      ])) };
      const vInside = valueIteration(inside, 0.9, { theta: 1e-12 }).v;
      return vFix.every((x, s) => close(x, vInside[s], 1e-6));
    },
  },
  "ch05.is-ratio-model-free": {
    kind: "fact", // (5.3): the ratio of trajectory probabilities, transition probabilities included, equals the product of policy ratios
    run: () => {
      const { m, target, behaviour, s } = BJ_EX54();
      const rng = makeRng(56);
      for (let e = 0; e < 2000; e++) {
        const { steps } = generateEpisode(m, behaviour, s, rng);
        let num = 1;
        let den = 1;
        for (const x of steps) {
          const p = m.dynamics[x.s][x.a].filter((o) => o.next === x.next).reduce((a, o) => a + o.prob, 0);
          num *= target[x.s][x.a] * p;
          den *= behaviour[x.s][x.a] * p;
        }
        if (!close(num / den, importanceRatio(steps, target, behaviour), 1e-12)) return false;
      }
      return true;
    },
  },
  "ch05.ordinary-is-unbiased": {
    kind: "fact", // §5.5: E_µ[ρG] = v_π: for Example 5.4's state the first moment, computed exactly, equals the exact value −0.27720
    run: () => {
      const { m, target, s } = BJ_EX54();
      return close(bjIsMoment(m, target, s, 1), solveExact(m, target, 1)![s], 1e-12);
    },
  },
  "ch05.fig5-7": {
    kind: "fact", // Example 5.4, Figure 5.7 (100 runs × 1000 episodes): weighted IS has lower error at first; its error first rises, then falls
    // (Exercise 5.5); both are accurate after 1000 episodes; ordinary IS follows its exact error Var(ρG)/n, with Var(ρG) = 10.156
    run: () => {
      const { m, target, behaviour, s } = BJ_EX54();
      const truth = solveExact(m, target, 1)![s];
      const R = 100;
      const N = 1000;
      const mseO = new Float64Array(N);
      const mseW = new Float64Array(N);
      for (let r = 0; r < R; r++) {
        const c = isEstimates(m, target, behaviour, s, N, 1, makeRng(1000 + r));
        for (let n = 0; n < N; n++) {
          mseO[n] += (c.ordinary[n] - truth) ** 2 / R;
          mseW[n] += (c.weighted[n] - truth) ** 2 / R;
        }
      }
      const variance = bjIsMoment(m, target, s, 2) - truth ** 2;
      const rises = Math.max(...Array.from(mseW.slice(1, 30))) > 1.5 * mseW[0];
      const early = Array.from({ length: 10 }, (_, n) => n).every((n) => mseW[n] < mseO[n]);
      return close(variance, 10.156, 0.001) && rises && early && mseO[N - 1] < 0.03 && mseW[N - 1] < 0.03 && mseO[9] > variance / 10 / 2 && mseO[9] < (2 * variance) / 10;
    },
  },
  "ch05.fig5-8": {
    kind: "fact", // Example 5.5, Figure 5.8: E[ρG] = 1, but E[(ρG)²] = 0.2 Σ 1.8^k diverges (episodes enumerated by length, up to 40);
    // weighted IS is exactly 1 from the first episode that ends with "back", in 10 runs
    run: () => {
      let mean = 0;
      let square = 0;
      for (let k = 0; k < 40; k++) {
        const p = 0.5 ** (k + 1) * 0.9 ** k * 0.1; // k returns to s, then back to termination, each action chosen by µ with 1/2
        const rho = 2 ** (k + 1);
        mean += p * rho;
        square += p * rho * rho;
        if (!close(square, 0.2 * Array.from({ length: k + 1 }, (_, j) => 1.8 ** j).reduce((a, b) => a + b, 0), 1e-6 * square)) return false;
      }
      const runs = Array.from({ length: 10 }, (_, r) => isEstimates(infiniteVarianceMdp(), INFINITE_VARIANCE_TARGET, INFINITE_VARIANCE_BEHAVIOUR, 0, 2000, 1, makeRng(77 + r)));
      const weightedOne = runs.every((c) => {
        const first = Array.from(c.weighted).findIndex((x) => x !== 0);
        return first >= 0 && Array.from(c.weighted.slice(first)).every((x) => close(x, 1, 1e-12));
      });
      return close(mean, 1 - 0.9 ** 40, 1e-9) && square > 1e9 && weightedOne; // the mean is 1 in the limit: Σ 0.1·0.9^k
    },
  },
  "ch05.incremental-weighted": {
    kind: "fact", // (5.6)–(5.7): the incremental update V_{n+1} = V_n + (W_n/C_n)(G_n − V_n) equals the batch weighted average
    run: () => {
      const rng = makeRng(57);
      const G = Array.from({ length: 50 }, () => 10 * rng() - 5);
      const W = Array.from({ length: 50 }, () => (rng() < 0.2 ? 0 : 3 * rng()));
      const inc = weightedIncremental(G, W, 0);
      return G.every((_, n) => {
        const den = W.slice(0, n + 1).reduce((a, b) => a + b, 0);
        if (den === 0) return true;
        return close(inc[n + 1], W.slice(0, n + 1).reduce((a, w, k) => a + w * G[k], 0) / den, 1e-9);
      });
    },
  },
  "ch05.flat-partial-returns": {
    kind: "fact", // §5.8: G_t = γ^{T−t−1} Ḡ_t^T + (1 − γ) Σ_{h=t+1}^{T−1} γ^{h−t−1} Ḡ_t^h, for random rewards and γ
    run: () => {
      const rng = makeRng(58);
      for (let trial = 0; trial < 50; trial++) {
        const T = 1 + Math.floor(rng() * 12);
        const R = Array.from({ length: T }, () => 4 * rng() - 2); // R[k] = R_{k+1}
        const g = rng();
        const flat = (h: number) => R.slice(0, h).reduce((a, b) => a + b, 0); // Ḡ_0^h
        let rhs = g ** (T - 1) * flat(T);
        for (let h = 1; h <= T - 1; h++) rhs += (1 - g) * g ** (h - 1) * flat(h);
        if (!close(discountedReturn(R, g), rhs, 1e-9)) return false;
      }
      return true;
    },
  },
  "ch05-q005": {
    kind: "answer", // (5.3) in Example 5.4: a game following the target for three decisions, and one where the behaviour sticks at 13
    run: () => {
      const { target, behaviour, s } = BJ_EX54();
      const s2 = bjIndex(16, 2, true);
      const s3 = bjIndex(20, 2, true); // soft 16 plus a 4 is soft 20
      const follow = [{ t: 0, s, a: BJ_HIT, r: 0, next: s2 }, { t: 1, s: s2, a: BJ_HIT, r: 0, next: s3 }, { t: 2, s: s3, a: BJ_STICK, r: 1, next: BJ_END }];
      const deviate = [{ t: 0, s, a: BJ_STICK, r: -1, next: BJ_END }];
      return [importanceRatio(follow, target, behaviour), importanceRatio(deviate, target, behaviour)];
    },
  },
  "ch05-q006": {
    kind: "answer", // (5.4) and (5.5) for ratios (8, 0, 2) and returns (1, −1, −1)
    run: () => {
      const rho = [8, 0, 2];
      const G = [1, -1, -1];
      const num = rho.reduce((a, r, i) => a + r * G[i], 0);
      return [num / rho.length, num / rho.reduce((a, b) => a + b, 0)];
    },
  },
  "ch05-q007": { kind: "answer", run: () => weightedIncremental([1, -1], [2, 6], 0).slice(1) }, // (5.7): V_2, V_3
  "ch05-q008": {
    kind: "answer", // ε-greedy with 4 actions, ε = 0.2: greedy and other probabilities; Σ π'(a|s) q(s,a) for q = (1, 2, 3, 4)
    run: () => {
      const p = [1, 2, 3, 4].map((_, a) => 0.2 / 4 + (a === 3 ? 0.8 : 0));
      return [p[3], p[0], p.reduce((acc, x, a) => acc + x * (a + 1), 0)];
    },
  },
  "ch05-q009": {
    kind: "answer", // Example 5.5: E[ρG] (all lengths) and the contribution of episodes of length 1–3 to E[(ρG)²]
    run: () => {
      let mean = 0;
      let sq = 0;
      for (let k = 0; k < 400; k++) {
        const p = 0.5 ** (k + 1) * 0.9 ** k * 0.1;
        mean += p * 2 ** (k + 1);
        if (k < 3) sq += p * 4 ** (k + 1);
      }
      return [mean, sq];
    },
  },
  "ch05-q010": {
    kind: "answer", // §5.8, γ = 0.5, rewards 1, 2, 3: the flat partial return Ḡ_0^2 and the full return from the decomposition
    run: () => {
      const R = [1, 2, 3];
      const flat = (h: number) => R.slice(0, h).reduce((a, b) => a + b, 0);
      return [flat(2), 0.5 ** 2 * flat(3) + 0.5 * (flat(1) + 0.5 * flat(2))];
    },
  },
  "ch05-q011": {
    kind: "answer", // Example 5.4: exact expected squared error of ordinary IS after 10 and 100 episodes, Var(ρG)/n
    run: () => {
      const { m, target, s } = BJ_EX54();
      const v = solveExact(m, target, 1)![s];
      const variance = bjIsMoment(m, target, s, 2) - v * v;
      return [variance / 10, variance / 100];
    },
  },
  "lab.mc.racetrack": {
    kind: "fact", // Exercise 5.9 (lab task), left track of Figure 5.11. Every policy ends (random policy, 2000 episodes). After 200,000
    // episodes of off-policy MC control (Figure 5.10, corrected), the learned greedy policy, evaluated exactly with the noise, is within
    // 1.5 steps of the value-iteration optimum from the three leftmost start cells, within 5 steps on average over the start line, and its
    // noise-free runs all reach the finish. From the right end of the start line it is still several steps worse (measured over seeds
    // 59–61: 4–12 steps at 200,000 episodes, shrinking by 500,000): episodes there are long, and this method learns only from the tails
    // of episodes after their last non-greedy action (§5.7).
    run: () => {
      const m = racetrack(TRACK_LEFT);
      const rng = makeRng(59);
      const random = equiprobablePolicy(m);
      for (let e = 0; e < 2000; e++) if (generateEpisode(m, random, m.starts[e % m.starts.length], rng, { maxSteps: 1000 }).truncated) return false;
      const vstar = valueIteration(m, 1, { theta: 1e-9 }).v;
      const st = newOffPolicyControl(m);
      for (let e = 0; e < 200_000; e++) offPolicyControlEpisode(m, st, m.starts[Math.floor(rng() * m.starts.length)], 1, 0.1, rng);
      const learned = iterativePolicyEvaluation(m, deterministic(m, st.pi), 1, { theta: 1e-9 }).v;
      const gaps = m.starts.map((s) => vstar[s] - learned[s]);
      const finishes = m.starts.every((s) => greedyTrajectory(m, st.pi, s).finished);
      return gaps.every((g) => g >= -1e-6) && gaps.slice(0, 3).every((g) => g < 1.5) && gaps.reduce((a, b) => a + b, 0) / gaps.length < 5 && finishes;
    },
  },
  // ----- Chapter 9, Milestone 4K: on-policy approximation -----
  "ch09-q012": {
    kind: "answer", // linear gradient step: w = (1, 2), x = (1, 0.5), V = 3, α = 0.1: v̂ before, then the new weights
    run: () => {
      const w = [1, 2];
      const x = [1, 0.5];
      const before = ap.linearValue(w, x);
      ap.gradientStep(w, x, 3, 0.1);
      return [before, w[0], w[1]];
    },
  },
  "ch09-q013": {
    kind: "answer", // the bound factor (1 − γλ)/(1 − γ) for γ = 0.9 with λ = 0.5 and λ = 1
    run: () => [(1 - 0.9 * 0.5) / (1 - 0.9), (1 - 0.9 * 1) / (1 - 0.9)],
  },
  "ch09-q014": {
    kind: "answer", // tile coding, m = 8 present binary features, value 2, target 5: value after one step with α = 1/8 and α = 1/80
    run: () => [1 / 8, 1 / 80].map((a) => {
      const w = new Array(8).fill(2 / 8);
      const x = new Array(8).fill(1);
      ap.gradientStep(w, x, 5, a);
      return ap.linearValue(w, x);
    }),
  },
  "ch09-q015": {
    kind: "answer", // RBF feature exp(−‖s − c‖²/2σ²) with s = 1, c = 0, σ = 1
    run: () => [Math.exp(-(1 ** 2) / 2)],
  },
  "ch09.ex9-1": {
    kind: "fact", // Exercise 9.1: linear gradient-descent TD(λ) (9.5)–(9.7) with one feature per state (x(s) a unit vector) makes exactly the updates
    // of tabular TD(λ) with accumulating traces (19-state walk, λ = 0.8, α = 0.1, 30 episodes)
    run: () => {
      const rng = makeRng(5);
      const walks = Array.from({ length: 30 }, () => tr.sampleWalk(19, rng));
      const w = new Array(21).fill(0);
      const V = new Array(21).fill(0);
      const f = ap.tabularFeatures(21);
      for (const wk of walks) {
        ap.linearTdLambdaEpisode(w, wk, f, 0.8, 0.1, 1);
        tr.tdLambdaEpisode(V, wk, 0.8, 0.1, 1, "accumulating");
      }
      return w.every((x, i) => i === 0 || i === 20 || Math.abs(x - V[i]) < 1e-12);
    },
  },
  "ch09.ex9-2": {
    kind: "fact", // Exercise 9.2: state aggregation (one table entry per group, updated whenever a member is updated) is the gradient method with one
    // indicator feature per group: TD(0) on the 19-state walk with groups of 4 gives the same group values both ways (to 1e-12)
    run: () => {
      const rng = makeRng(6);
      const walks = Array.from({ length: 30 }, () => tr.sampleWalk(19, rng));
      const f = ap.aggregationFeatures(19, 4);
      const w = new Array(5).fill(0);
      const table = new Array(5).fill(0);
      const g = (s: number) => Math.floor((s - 1) / 4);
      for (const wk of walks) {
        ap.linearTdLambdaEpisode(w, wk, f, 0, 0.1, 1);
        const T = wk.rewards.length;
        for (let t = 0; t < T; t++) {
          const v2 = t + 1 === T ? 0 : table[g(wk.states[t + 1])];
          table[g(wk.states[t])] += 0.1 * (wk.rewards[t] + v2 - table[g(wk.states[t])]);
        }
      }
      return w.every((x, i) => Math.abs(x - table[i]) < 1e-12);
    },
  },
  "ch09.ex9-4": {
    kind: "fact", // Exercise 9.4: off-line, the backward view (9.5)–(9.7) and the forward view (9.4) make identical updates with linear features
    // (aggregation into groups of 4, λ = 0.7, γ = 0.9, α = 0.05; to 1e-12)
    run: () => {
      const rng = makeRng(5);
      const walks = Array.from({ length: 30 }, () => tr.sampleWalk(19, rng));
      const f = ap.aggregationFeatures(19, 4);
      const a = new Array(5).fill(0.1);
      const b = [...a];
      for (const wk of walks) {
        ap.linearTdLambdaEpisode(a, wk, f, 0.7, 0.05, 0.9, "offline");
        ap.linearLambdaReturnOffline(b, wk, f, 0.7, 0.05, 0.9);
        if (a.some((x, i) => Math.abs(x - b[i]) > 1e-12)) return false;
      }
      return true;
    },
  },
  "ch09.bound": {
    kind: "fact", // (9.9): on a continuing 20-state reflecting walk with aggregation into 4 groups and the stationary distribution, the TD(λ) fixed point
    // has RMSE within (1 − γλ)/(1 − γ) of the best possible, for γ = 0.9 and 0.99 and λ = 0, 0.5, 0.9; at λ = 1 it is the best possible; and
    // smaller λ gives larger error
    run: () =>
      [0.9, 0.99].every((g) => {
        const c = ap.reflectingWalk(20, g);
        const d = ap.stationary(c.P);
        const Phi = Array.from({ length: 20 }, (_, s) => ap.aggregationFeatures(20, 5)(s + 1));
        const best = ap.rmse(c, Phi, ap.bestWeights(c, Phi, d), d);
        const errs = [0, 0.5, 0.9, 1].map((l) => ap.rmse(c, Phi, ap.tdFixedPoint(c, Phi, d, l), d));
        return [0, 0.5, 0.9].every((l, i) => errs[i] <= ((1 - g * l) / (1 - g)) * best + 1e-9) && close(errs[3], best, 1e-9) && errs[0] > errs[1] && errs[1] > errs[2] && errs[2] > best;
      }),
  },
  "ch09.tile-one-trial": {
    kind: "fact", // §9.3: with tile coding (m tilings, one feature present per tiling) and α = 1/m, a single example s ↦ v makes v̂(s, w) = v exactly,
    // whatever the prior value; with α = 1/(10m) it moves one tenth of the way
    run: () => {
      const coder = ap.tileCoder(8, 9, makeRng(3));
      const w = Array.from({ length: coder.size }, (_, i) => Math.sin(i));
      const x = new Array(coder.size).fill(0);
      for (const i of coder.active(0.37, 0.61)) x[i] = 1;
      const before = ap.linearValue(w, x);
      const w2 = [...w];
      ap.gradientStep(w2, x, 5, 1 / (10 * 8));
      ap.gradientStep(w, x, 5, 1 / 8);
      return close(ap.linearValue(w, x), 5, 1e-12) && close(ap.linearValue(w2, x), before + (5 - before) / 10, 1e-12);
    },
  },
  "ch09.coarse-coding": {
    kind: "fact", // Example 9.1, Figure 9.4 (50 interval features, widths 0.08, 0.2, 0.5 of the extent, α = 0.2/m, 20 runs): width strongly affects early learning
    // (after 40 examples the errors differ by more than 0.05) but hardly the final approximation (after 10,240 examples all within 0.01 of each other)
    run: () => {
      const cps = [40, 10240];
      const errs = [0.08, 0.2, 0.5].map((width) => {
        const e = [0, 0];
        for (let r = 0; r < 20; r++) ap.coarseCodingRun(width, 50, cps, makeRng(r)).forEach((o, i) => (e[i] += ap.squareWaveError(width, 50, o.w) / 20));
        return e;
      });
      const early = errs.map((e) => e[0]);
      const late = errs.map((e) => e[1]);
      return Math.max(...early) - Math.min(...early) > 0.05 && Math.max(...late) - Math.min(...late) < 0.01;
    },
  },
  "ch09.mountain-car": {
    kind: "fact", // Example 9.2: linear Sarsa(λ) (Figure 9.8, replacing traces with clearing, ten 9 × 9 tilings, λ = 0.9, ε = 0, α = 0.05 = 0.5/m, γ = 1) solves the
    // task: in each of 3 runs the first 10 episodes average over 400 steps and episodes 91–100 under 80 (random starts)
    run: () =>
      [0, 1, 2].every((r) => {
        const ag = ap.newMcAgent(10, makeRng(100 + r));
        const rr = makeRng(r);
        const st: number[] = [];
        for (let e = 0; e < 100; e++) st.push(ap.mcEpisode(ag, { alpha: 0.05, lambda: 0.9, epsilon: 0, traces: "replacing", clearOthers: true }, rr));
        return st.slice(0, 10).reduce((a, b) => a + b) / 10 > 400 && st.slice(90).reduce((a, b) => a + b) / 10 < 80;
      }),
  },
  "ch09.watkins-linear": {
    kind: "fact", // Figure 9.9: linear Watkins's Q(λ) with binary features (ten 9 × 9 tilings, replacing traces, λ = 0.9, α = 0.05, ε = 0.05) also solves the
    // mountain-car task: in each of 2 runs episodes 91–100 average under 120 steps, against over 300 for the first 10
    run: () =>
      [0, 1].every((r) => {
        const ag = ap.newMcAgent(10, makeRng(300 + r));
        const rr = makeRng(r);
        const st: number[] = [];
        for (let e = 0; e < 100; e++) st.push(ap.mcQLambdaEpisode(ag, { alpha: 0.05, lambda: 0.9, epsilon: 0.05, traces: "replacing" }, rr));
        return st.slice(0, 10).reduce((a, b) => a + b) / 10 > 300 && st.slice(90).reduce((a, b) => a + b) / 10 < 120;
      }),
  },
  "ch09.fig9-11": {
    kind: "fact", // Figure 9.11 (five 9 × 9 tilings, steps per episode over the first 20 episodes, 5 runs; 2 for the slow accumulating case): with λ = 0.9 and α = 0.8/5, replacing traces
    // stay under 400 steps while accumulating traces blow up (over 2000); with replacing traces at α = 1.2/5, λ = 1 is much worse than λ = 0.9
    // (at smaller α the difference is within the noise of 5 runs)
    run: () => {
      const avg = (traces: "replacing" | "accumulating", lambda: number, a5: number, runs = 5) => {
        let tot = 0;
        for (let r = 0; r < runs; r++) {
          const ag = ap.newMcAgent(5, makeRng(200 + r));
          const rr = makeRng(r);
          for (let e = 0; e < 20; e++) tot += ap.mcEpisode(ag, { alpha: a5 / 5, lambda, epsilon: 0, traces, clearOthers: traces === "replacing", maxSteps: 4000 }, rr) / (20 * runs);
        }
        return tot;
      };
      const rep = avg("replacing", 0.9, 0.8);
      return rep < 400 && avg("accumulating", 0.9, 0.8, 2) > 2000 && avg("replacing", 1, 1.2) > 1.5 * avg("replacing", 0.9, 1.2);
    },
  },
  // ----- Chapter 8, Milestone 4J: planning and learning -----
  "ch08-q008": {
    kind: "answer", // a Dyna-Q planning backup: Q = 0, R = 0, max_a Q(S′, a) = 0.5, α = 0.1, γ = 0.95; and 1 + n backups per real step for n = 5
    run: () => [0.1 * (0 + 0.95 * 0.5 - 0), 1 + 5],
  },
  "ch08-q010": {
    kind: "answer", // Dyna-Q+ planning reward R + κ√τ with R = 0, κ = 0.001, τ = 10,000
    run: () => [0 + 0.001 * Math.sqrt(10_000)],
  },
  "ch08-q014": {
    kind: "answer", // Figure 8.13's error after t = 25 sample backups with b = 100
    run: () => [pl.sampleBackupError(100, 25)],
  },
  "ch08.q-planning": {
    kind: "fact", // Figure 8.1: random-sample one-step Q-planning with the maze itself as the sample model (α = 0.5, γ = 0.95) finds a greedy policy
    // that follows a shortest path (14 steps) within 20,000 planning backups, and the greedy policy is not yet complete after 100
    run: () => {
      const env = pl.mazeEnv(pl.DYNA_MAZE);
      const Q = Array.from({ length: env.n }, () => [0, 0, 0, 0]);
      const rng = makeRng(2);
      pl.qPlanning(env, Q, 100, 0.5, 0.95, rng);
      const early = pl.greedyIsOptimal(env, Q);
      pl.qPlanning(env, Q, 19_900, 0.5, 0.95, rng);
      return !early && pl.greedyIsOptimal(env, Q);
    },
  },
  "ch08.dyna-maze": {
    kind: "fact", // Example 8.1, Figure 8.5 (30 runs, α = 0.1, ε = 0.1, γ = 0.95, random tie-breaking): the average episode stays below 20 steps
    // from about episode 20–35 with n = 0, by episode 8 with n = 5, and by episode 4 with n = 50 (the draft: about 25, 5 and 3); the shortest path is 14
    run: () => {
      const env = pl.mazeEnv(pl.DYNA_MAZE);
      const settle = (n: number) => {
        const acc = new Array(50).fill(0);
        for (let r = 0; r < 30; r++) pl.dynaEpisodes(env, { n, alpha: 0.1, gamma: 0.95, epsilon: 0.1 }, 50, makeRng(100 + r)).forEach((x, i) => (acc[i] += x / 30));
        return acc.findIndex((_, i) => i > 0 && acc.slice(i).every((y) => y < 20)) + 1;
      };
      const [s0, s5, s50] = [0, 5, 50].map(settle);
      return env.openStates === 47 && pl.shortestPath(env) === 14 && s0 >= 20 && s0 <= 35 && s5 <= 8 && s50 <= 4 && s50 < s5 && s5 < s0;
    },
  },
  "ch08.fig8-6": {
    kind: "fact", // Figure 8.6: halfway through the second episode the nonplanning agent (n = 0) has a greedy action in only one state (the last
    // step learned), while the n = 50 agent already has one in at least 10 states, and in at least 40 by the end of that episode (seed 7)
    run: () => {
      const env = pl.mazeEnv(pl.DYNA_MAZE);
      const second = (n: number) => {
        const rng = makeRng(7);
        const cfg = { n, alpha: 0.1, gamma: 0.95, epsilon: 0.1 };
        const ag = pl.newDynaAgent(env.n);
        pl.dynaEpisodes(env, cfg, 1, rng, ag);
        const counts: number[] = [];
        let s = env.start;
        for (;;) {
          const r = pl.dynaStep(env, ag, s, cfg, rng);
          counts.push(pl.greedyArrows(ag.Q).filter((x) => x !== null).length);
          if (r.done) break;
          s = r.next;
        }
        return { half: counts[Math.floor(counts.length / 2)], end: counts[counts.length - 1] };
      };
      const a = second(0);
      const b = second(50);
      return a.half === 1 && b.half >= 10 && b.end >= 40;
    },
  },
  "ch08.first-episode": {
    kind: "fact", // Example 8.1: before anything is learned the agent's actions are uniformly random (all values 0, ties broken at random), and the
    // expected first-episode length is 868.7 steps; the draft's "about 1700" is one run (its seed was held constant), within the walk's wide spread
    run: () => {
      const env = pl.mazeEnv(pl.DYNA_MAZE);
      const e = pl.randomWalkEpisodeLength(env);
      const rng = makeRng(3);
      const lens = Array.from({ length: 300 }, () => pl.dynaEpisodes(env, { n: 0, alpha: 0.1, gamma: 0.95, epsilon: 0.1 }, 1, rng)[0]);
      const mean = lens.reduce((x, y) => x + y, 0) / lens.length;
      return Math.abs(e - 868.7) < 0.1 && Math.abs(mean - e) < 0.15 * e && lens.filter((x) => x >= 1700).length > 15;
    },
  },
  "ch08.blocking": {
    kind: "fact", // Example 8.2, Figure 8.7 (our parameters: n = 50, α = 1, ε = 0.1, γ = 0.95, κ = 0.001; 10 runs): Dyna-Q+ is ahead at step 1000 and
    // further ahead at 3000; after the change both agents find the new path (their cumulative reward rises again), Dyna-Q+ faster
    run: () => {
      const cfg = { n: 50, alpha: 1, gamma: 0.95, epsilon: 0.1 };
      const avg = (extra: object) => {
        let a = 0;
        let b = 0;
        let c = 0;
        for (let r = 0; r < 10; r++) {
          const cum = pl.dynaChanging(pl.BLOCKING_MAZE, 1000, 3000, { ...cfg, ...extra }, makeRng(r + 1));
          a += cum[999] / 10;
          b += cum[1999] / 10;
          c += cum[2999] / 10;
        }
        return { a, b, c };
      };
      const q = avg({});
      const qp = avg({ kappa: 1e-3 });
      return qp.a > q.a && qp.c > q.c && q.c > q.b && qp.c - qp.a > q.c - q.a;
    },
  },
  "ch08.shortcut": {
    kind: "fact", // Example 8.3, Figure 8.8 (same parameters, 10 runs): after the shortcut opens, Dyna-Q's greedy path at step 6000 still takes the long way in
    // most runs, while Dyna-Q+'s takes the shortcut in most runs; Dyna-Q+ ends with more cumulative reward
    run: () => {
      const cfg = { n: 50, alpha: 1, gamma: 0.95, epsilon: 0.1 };
      const env = pl.mazeEnv(pl.SHORTCUT_MAZE[1]);
      const short = pl.shortestPath(env);
      const run = (extra: object) => {
        let usesShortcut = 0;
        let total = 0;
        for (let r = 0; r < 10; r++) {
          const ag = pl.newDynaAgent(env.n);
          const cum = pl.dynaChanging(pl.SHORTCUT_MAZE, 3000, 6000, { ...cfg, ...extra }, makeRng(r + 1), ag);
          total += cum[5999] / 10;
          if (pl.greedyPathLength(env, ag.Q) === short) usesShortcut++;
        }
        return { usesShortcut, total };
      };
      const q = run({});
      const qp = run({ kappa: 1e-3 });
      return q.usesShortcut <= 3 && qp.usesShortcut >= 7 && qp.total > q.total;
    },
  },
  "ch08.ex8-4": {
    kind: "fact", // Exercise 8.4 (lab task): with the bonus κ√τ used only in action selection, not in backups, the agent beats Dyna-Q on the blocking
    // maze (the change is near the path it follows) but, unlike Dyna-Q+, rarely finds the distant shortcut: it cannot plan a trip to try it
    run: () => {
      const cfg = { n: 50, alpha: 1, gamma: 0.95, epsilon: 0.1 };
      let block = 0;
      let blockQ = 0;
      for (let r = 0; r < 10; r++) {
        block += pl.dynaChanging(pl.BLOCKING_MAZE, 1000, 3000, { ...cfg, kappa: 1e-3, bonusIn: "selection" }, makeRng(r + 1))[2999] / 10;
        blockQ += pl.dynaChanging(pl.BLOCKING_MAZE, 1000, 3000, cfg, makeRng(r + 1))[2999] / 10;
      }
      const env = pl.mazeEnv(pl.SHORTCUT_MAZE[1]);
      const short = pl.shortestPath(env);
      let found = 0;
      for (let r = 0; r < 10; r++) {
        const ag = pl.newDynaAgent(env.n);
        pl.dynaChanging(pl.SHORTCUT_MAZE, 3000, 6000, { ...cfg, kappa: 1e-3, bonusIn: "selection" }, makeRng(r + 1), ag);
        if (pl.greedyPathLength(env, ag.Q) === short) found++;
      }
      return block > blockQ && found <= 3;
    },
  },
  "ch08.prioritized": {
    kind: "fact", // Example 8.4: on the Dyna maze and the same maze at 3× resolution (423 states), with at most n = 5 backups per real step and α = 1,
    // prioritized sweeping needs far fewer backups than Dyna-Q before the greedy policy is optimal (median of 3 runs; factor above 5, here over 20)
    run: () => {
      const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[1];
      return [1, 3].every((k) => {
        const m = pl.scaleMaze(pl.DYNA_MAZE, k);
        const cfg = { n: 5, alpha: 1, gamma: 0.95, epsilon: 0.1, theta: 1e-4 };
        const d = med([1, 2, 3].map((r) => pl.backupsUntilOptimal(m, "dyna-q", cfg, makeRng(r))));
        const p = med([1, 2, 3].map((r) => pl.backupsUntilOptimal(m, "prioritized", cfg, makeRng(r))));
        return Number.isFinite(p) && d / p > 5;
      });
    },
  },
  "ch08.sample-backups": {
    kind: "fact", // Figure 8.13: with b equally likely successors, t sample backups leave error √((b − 1)/(b t)); for b = 10,000 the error is 0.1 after
    // only 1% of the b backups a full backup costs, and below 1/√b after b of them; with b = 1 a single sample backup is exact
    run: () =>
      close(pl.sampleBackupError(10_000, 100), Math.sqrt(9999 / 1_000_000), 1e-12) &&
      pl.sampleBackupError(10_000, 100) < 0.1 &&
      [2, 10, 100, 1000, 10_000].every((b) => pl.sampleBackupError(b, b) < 1 / Math.sqrt(b) && pl.sampleBackupError(b, 0) === 1) &&
      pl.sampleBackupError(1, 1) === 0,
  },
  "ch08.trajectory-sampling": {
    kind: "fact", // Figure 8.14 (1000 states, 10 random tasks, full backups (8.1), on-policy with ε = 0.1; rewards ours, see the lab): on-policy
    // distribution is ahead after 500 backups and behind after 5000, for b = 1 and b = 3; with b = 1 it stays ahead longer (still ahead at 1500)
    run: () => {
      const curve = (b: number, mode: "uniform" | "on-policy") => {
        const acc = new Array(11).fill(0);
        for (let i = 0; i < 10; i++) pl.trajectorySampling(pl.randomTask(1000, b, makeRng(1000 + i)), mode, 5000, 500, makeRng(i), [500, 1500, 5000]).forEach((x, j) => (acc[j] += x / 10));
        return acc;
      };
      const [u1, o1, u3, o3] = [curve(1, "uniform"), curve(1, "on-policy"), curve(3, "uniform"), curve(3, "on-policy")];
      return o1[1] > u1[1] && o1[10] < u1[10] && o3[1] > u3[1] && o3[10] < u3[10] && o1[3] > u1[3];
    },
  },
  // ----- Chapter 7, Milestone 4I: eligibility traces -----
  "ch07.error-reduction": {
    kind: "fact", // (7.5): on the 19-state walk with γ = 0.9, for random value functions v, the expected n-step return (the n-fold Bellman
    // expectation operator applied to v) is within γ^n of v's worst-state error, for n = 1 … 10
    run: () => {
      const m = tr.randomWalkN(19);
      const pi = equiprobablePolicy(m);
      const gamma = 0.9;
      const vpi = solveExact(m, pi, gamma)!;
      const backup = (v: number[]) => v.map((_, s) => (m.terminal[s] ? 0 : m.dynamics[s][0].reduce((a, o) => a + o.prob * (o.reward + gamma * (m.terminal[o.next] ? 0 : v[o.next])), 0)));
      const rng = makeRng(17);
      return Array.from({ length: 20 }).every(() => {
        let v = m.states.map((_, s) => (m.terminal[s] ? 0 : 4 * rng() - 2));
        const err0 = Math.max(...v.map((x, s) => Math.abs(x - vpi[s])));
        for (let n = 1; n <= 10; n++) {
          v = backup(v);
          if (Math.max(...v.map((x, s) => Math.abs(x - vpi[s]))) > gamma ** n * err0 + 1e-12) return false;
        }
        return true;
      });
    },
  },
  "ch07.fig7-2": {
    kind: "fact", // Example 7.1, Figure 7.2 (19-state walk, values from 0, RMS over the first 10 episodes, 100 runs, the same walks for all):
    // on-line, an intermediate n (2 to 8) is best, at about 0.27; off-line the best is about 0.34, worse than on-line, and every off-line
    // method has blown up (error above 0.6) by α = 0.4
    run: () => {
      const sets = tr.walkSets(100, 10, makeRng(1));
      const alphas = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
      const best = (n: number, mode: tr.Mode) => Math.min(...alphas.map((a) => tr.walkExperiment({ kind: "n-step", n, mode }, a, sets)));
      const ns = [1, 2, 4, 8, 16, 64];
      const on = ns.map((n) => best(n, "online"));
      const off = ns.map((n) => best(n, "offline"));
      const iOn = on.indexOf(Math.min(...on));
      const blown = ns.every((n) => tr.walkExperiment({ kind: "n-step", n, mode: "offline" }, 0.4, sets) > 0.6);
      return [2, 4, 8].includes(ns[iOn]) && on[iOn] > 0.25 && on[iOn] < 0.29 && Math.min(...off) > 0.32 && Math.min(...off) < 0.36 && Math.min(...off) > on[iOn] && blown;
    },
  },
  "ch07.ex7-3-odd-n": {
    kind: "fact", // Exercise 7.3 (the off-line panel of Figure 7.2): at α = 0.2, off-line n = 3 and n = 5 have already blown up (error above 0.45)
    // while n = 2 and n = 4 are still learning (below 0.42)
    run: () => {
      const sets = tr.walkSets(100, 10, makeRng(1));
      const e = (n: number) => tr.walkExperiment({ kind: "n-step", n, mode: "offline" }, 0.2, sets);
      return e(3) > 0.45 && e(5) > 0.45 && e(2) < 0.42 && e(4) < 0.42;
    },
  },
  "ch07.offline-equivalence": {
    kind: "fact", // §7.4: off-line, the λ-return algorithm and TD(λ) with accumulating traces make the same updates (to 1e-12), for several λ and γ;
    // at λ = 1 both equal off-line constant-α MC
    run: () => {
      const rng = makeRng(5);
      const walks = Array.from({ length: 30 }, () => tr.sampleWalk(19, rng));
      return ([[0.5, 1], [0.8, 0.9], [1, 0.95]] as const).every(([lambda, gamma]) => {
        const A = Array.from({ length: 21 }, (_, i) => Math.sin(i));
        const B = [...A];
        const C = [...A];
        for (const w of walks) {
          tr.lambdaReturnEpisode(A, w, lambda, 0.1, gamma, "offline");
          tr.tdLambdaEpisode(B, w, lambda, 0.1, gamma, "accumulating", { mode: "offline" });
          if (lambda === 1) tr.constantAlphaMcEpisode(C, w, 0.1, gamma, "offline");
          if (A.some((x, i) => Math.abs(x - B[i]) > 1e-12) || (lambda === 1 && C.some((x, i) => Math.abs(x - B[i]) > 1e-12))) return false;
        }
        return true;
      });
    },
  },
  "ch07.true-online-mc": {
    kind: "fact", // p. 182: true on-line TD(λ) with λ = 1, updating on-line, ends each episode exactly where constant-α MC applied at the episode's
    // end would (updates in time order), to 1e-12; and at λ = 0 every on-line method (n = 1, λ-return, the three traces, true on-line) is TD(0)
    run: () => {
      const rng = makeRng(6);
      const walks = Array.from({ length: 30 }, () => tr.sampleWalk(19, rng));
      const ok1 = walks.every((w) => {
        const a = Array.from({ length: 21 }, (_, i) => Math.cos(i));
        const b = [...a];
        tr.trueOnlineTdLambdaEpisode(a, w, 1, 0.1, 0.9);
        tr.constantAlphaMcEpisode(b, w, 0.1, 0.9, "sequential");
        return a.every((x, i) => Math.abs(x - b[i]) < 1e-12);
      });
      const ms: tr.PredictionMethod[] = [
        { kind: "n-step", n: 1, mode: "online" }, { kind: "lambda-return", lambda: 0, mode: "online" }, { kind: "td-lambda", lambda: 0, trace: "accumulating", mode: "online" },
        { kind: "td-lambda", lambda: 0, trace: "dutch", mode: "online" }, { kind: "td-lambda", lambda: 0, trace: "replacing", mode: "online" }, { kind: "true-online", lambda: 0 },
      ];
      const Vs = ms.map(() => new Array(21).fill(0));
      for (const w of walks) ms.forEach((m, i) => tr.runEpisode(Vs[i], w, m, 0.3));
      return ok1 && Vs.every((V) => V.every((x, i) => Math.abs(x - Vs[0][i]) < 1e-12));
    },
  },
  "ch07.fig7-6": {
    kind: "fact", // Figure 7.6 (same experiment, λ = 0.8 unless stated): on-line λ-return ≈ 0.26 at α = 0.4; on-line TD(λ) with accumulating traces
    // within 0.01 of it at α = 0.1 but blown up at λ = 0.95, α = 0.6; dutch traces and true on-line TD(λ) within 0.01 of the on-line λ-return at
    // α = 0.4 and still stable at λ = 0.95, α = 0.6; replacing traces below 0.27 at α = 0.5; off-line λ-return no better than 0.33 (λ = 0.9, α = 0.15)
    run: () => {
      const sets = tr.walkSets(100, 10, makeRng(1));
      const e = (m: tr.PredictionMethod, a: number) => tr.walkExperiment(m, a, sets);
      const lr = e({ kind: "lambda-return", lambda: 0.8, mode: "online" }, 0.4);
      const accSmall = e({ kind: "td-lambda", lambda: 0.8, trace: "accumulating", mode: "online" }, 0.1);
      const lrSmall = e({ kind: "lambda-return", lambda: 0.8, mode: "online" }, 0.1);
      const accBig = e({ kind: "td-lambda", lambda: 0.95, trace: "accumulating", mode: "online" }, 0.6);
      const dutch = e({ kind: "td-lambda", lambda: 0.8, trace: "dutch", mode: "online" }, 0.4);
      const dutchBig = e({ kind: "td-lambda", lambda: 0.95, trace: "dutch", mode: "online" }, 0.6);
      const tol = e({ kind: "true-online", lambda: 0.8 }, 0.4);
      const tolBig = e({ kind: "true-online", lambda: 0.95 }, 0.6);
      const repl = e({ kind: "td-lambda", lambda: 0.8, trace: "replacing", mode: "online" }, 0.5);
      const off = e({ kind: "lambda-return", lambda: 0.9, mode: "offline" }, 0.15);
      return lr > 0.25 && lr < 0.28 && Math.abs(accSmall - lrSmall) < 0.01 && accBig > 0.6 && Math.abs(dutch - lr) < 0.01 && Math.abs(tol - lr) < 0.01 && dutchBig < 0.5 && tolBig < 0.5 && repl < 0.27 && off > 0.33;
    },
  },
  "ch07.trace-types": {
    kind: "fact", // (7.12)–(7.13), Figure 7.9: the dutch trace equals the accumulating trace when α = 0 and the replacing trace when α = 1; with
    // γλ = 0.8 and visits at steps 0, 6, 7, 8, 9 the accumulating trace exceeds 2, the replacing trace never exceeds 1, and the dutch trace (α = 0.5) lies between
    run: () => {
      const visits = new Set([0, 6, 7, 8, 9]);
      const series = (kind: tr.TraceKind, alpha: number) => {
        let e = 0;
        return Array.from({ length: 16 }, (_, t) => (e = visits.has(t) ? tr.bumpTrace(0.8 * e, kind, alpha) : 0.8 * e));
      };
      const same = (a: number[], b: number[]) => a.every((x, i) => Math.abs(x - b[i]) < 1e-12);
      const acc = series("accumulating", 0.5);
      const rep = series("replacing", 0.5);
      const dut = series("dutch", 0.5);
      return same(series("dutch", 0), acc) && same(series("dutch", 1), rep) && Math.max(...acc) > 2 && Math.max(...rep) === 1 && dut.every((x, i) => x >= rep[i] - 1e-12 && x <= acc[i] + 1e-12);
    },
  },
  "ch07.traces-gridworld": {
    kind: "fact", // Example 7.2, Figure 7.13: after one episode ending in the only reward, one-step Sarsa raises only the last action value; Sarsa(λ)
    // with λ = 0.9 (γ = 1, accumulating) raises every pair on the path, each 0.9 times the next one closer to the reward
    run: () => {
      const g = tr.openGrid(7, 10, tr.EXAMPLE_7_2.goal);
      const { path, final } = tr.pathFromActions(g, tr.EXAMPLE_7_2.start, tr.EXAMPLE_7_2.actions);
      const alpha = 0.1;
      const one = tr.replayPath(g, path, final, 1, 0, alpha);
      const lam = tr.replayPath(g, path, final, 1, 0.9, alpha);
      const k = path.length;
      const changedOne = one.flat().filter((x) => x !== 0).length;
      const lastOne = one[path[k - 1].s][path[k - 1].a];
      const geometric = path.every((p, i) => Math.abs(lam[p.s][p.a] - alpha * 0.9 ** (k - 1 - i)) < 1e-12);
      return final === g.goal && changedOne === 1 && Math.abs(lastOne - alpha) < 1e-12 && geometric && lam.flat().filter((x) => x !== 0).length === k;
    },
  },
  "ch07.watkins": {
    kind: "fact", // §7.6, Figure 7.15: Watkins's Q(λ) with λ = 0 makes exactly Q-learning's updates (cliff walking, ε = 0.2, 30 episodes); with λ = 0.9
    // the traces are cut (all zero) after every nongreedy next action, and only then
    run: () => {
      const m = cliffWalking();
      const zero = () => m.states.map(() => m.actions.map(() => 0));
      const Q1 = zero();
      const E1 = zero();
      const Q2 = zero();
      const Q3 = zero();
      const E3 = zero();
      const rng = makeRng(3);
      let cutsOk = true;
      let cuts = 0;
      for (let ep = 0; ep < 30; ep++) {
        let s = m.grid.start;
        let a = epsilonGreedyAction(Q1, m, s, 0.2, rng).a;
        for (let k = 0; k < 400 && !m.terminal[s]; k++) {
          const o = m.dynamics[s][a][0];
          const a2 = m.terminal[o.next] ? null : epsilonGreedyAction(Q1, m, o.next, 0.2, rng).a;
          Q2[s][a] += 0.5 * (o.reward + (m.terminal[o.next] ? 0 : Math.max(...Q2[o.next])) - Q2[s][a]);
          tr.traceControlUpdate(Q1, E1, m, "watkins", "accumulating", { s, a, r: o.reward, s2: o.next, a2 }, 0.5, 1, 0);
          const greedy = a2 === null || m.terminal[o.next] || Q3[o.next][a2] === Math.max(...Q3[o.next]);
          const r3 = tr.traceControlUpdate(Q3, E3, m, "watkins", "accumulating", { s, a, r: o.reward, s2: o.next, a2 }, 0.5, 1, 0.9);
          if (r3.cut) cuts++;
          if (r3.cut === greedy || (r3.cut && E3.some((row) => row.some((x) => x !== 0)))) cutsOk = false;
          s = o.next;
          if (a2 === null) break;
          a = a2;
        }
        for (const row of E1) row.fill(0);
        for (const row of E3) row.fill(0);
      }
      return cutsOk && cuts > 0 && Q1.every((row, i) => row.every((x, j) => x === Q2[i][j]));
    },
  },
  "ch07.ex7-6-sparse": {
    kind: "fact", // Exercise 7.6: updating only states with traces above 0.01 (19-state walk, λ = 0.8, α = 0.2, 50 episodes) changes no value by more than
    // 0.002 and makes about a third fewer updates than updating every state with a nonzero trace (the saving grows with the number of states)
    run: () => {
      const rng = makeRng(8);
      const walks = Array.from({ length: 50 }, () => tr.sampleWalk(19, rng));
      const A = new Array(21).fill(0);
      const B = new Array(21).fill(0);
      let nA = 0;
      let nB = 0;
      for (const w of walks) {
        nA += tr.tdLambdaEpisode(A, w, 0.8, 0.2, 1, "accumulating");
        nB += tr.tdLambdaEpisode(B, w, 0.8, 0.2, 1, "accumulating", { minTrace: 0.01 });
      }
      return A.every((x, i) => Math.abs(x - B[i]) < 0.002) && nB < 0.7 * nA;
    },
  },
  "ch07-q004": {
    kind: "answer", // Exercise 7.4: the half-life τ with λ^τ = 1/2, τ = ln(1/2)/ln λ, for λ = 0.9 and λ = 0.5
    run: () => [tr.halfLife(0.9), tr.halfLife(0.5)],
  },
  "ch07-q009": {
    kind: "answer", // Example 7.1: first episode C → D → E → right (5-state walk, V = 0.5, α = 0.1), two-step TD off-line: V(C), V(D), V(E)
    run: () => {
      const V = [0, 0.5, 0.5, 0.5, 0.5, 0.5, 0];
      tr.nStepEpisode(V, { states: [3, 4, 5, 6], rewards: [0, 0, 1] }, 2, 0.1, 1, "offline");
      return [V[3], V[4], V[5]];
    },
  },
  "ch07-q011": {
    kind: "answer", // λ-return weights (1 − λ)λ^(n−1) for n = 1, 2, 3 with λ = 0.5
    run: () => [1, 2, 3].map((n) => 0.5 * 0.5 ** (n - 1)),
  },
  "ch07-q013": {
    kind: "answer", // a state visited at t = 0 and t = 2, γλ = 0.8: its trace at t = 2, accumulating, replacing, dutch (α = 0.5)
    run: () => (["accumulating", "replacing", "dutch"] as tr.TraceKind[]).map((k) => tr.bumpTrace(0.8 * 0.8 * tr.bumpTrace(0, k, 0.5), k, 0.5)),
  },
  "ch07-q014": {
    kind: "answer", // (7.11): ΔV(s) = αδE(s) with α = 0.1, δ = 0.5, E(s) = 0.64
    run: () => [0.1 * 0.5 * 0.64],
  },
  "ch07-q019": {
    kind: "answer", // Example 7.2 on the lab's 20-move path (α = 0.1, γ = 1): one-step Sarsa's raise of the last move; Sarsa(0.9)'s raise three steps before it
    run: () => {
      const g = tr.openGrid(7, 10, tr.EXAMPLE_7_2.goal);
      const { path, final } = tr.pathFromActions(g, tr.EXAMPLE_7_2.start, tr.EXAMPLE_7_2.actions);
      const one = tr.replayPath(g, path, final, 1, 0, 0.1);
      const lam = tr.replayPath(g, path, final, 1, 0.9, 0.1);
      const k = path.length;
      return [one[path[k - 1].s][path[k - 1].a], lam[path[k - 4].s][path[k - 4].a]];
    },
  },
  // ----- Chapter 1, Milestone 4H: tic-tac-toe (§1.5, Exercises 1.1–1.5) -----
  "ch01.ttt-positions": {
    kind: "fact", // 5478 positions are reachable from the empty board (X first, stopping at a win or a full board); up to the 8 symmetries
    // of the square they fall into 765 classes, and every image of a position has the same class
    run: () => {
      const all = ttt.reachablePositions();
      const classes = new Set([...all].map(ttt.canonical));
      const invariant = [...all].every((b) => ttt.SYMMETRIES.every((p) => ttt.canonical(p.map((i) => b[i]).join("")) === ttt.canonical(b)));
      return all.size === 5478 && classes.size === 765 && invariant;
    },
  },
  "ch01.ttt-minimax": {
    kind: "fact", // §1.5: minimax assumes a perfect opponent. Plain minimax (first of its tied moves) wins 87.5% against the defensive
    // opponent, where the best response wins 92.7%; against the random opponent both win 99.48%. The best player that never risks a loss
    // matches the best response against both opponents (so these opponents do not show the draft's point in its strongest form)
    run: () => {
      const M = ttt.minimaxValues();
      const firstTie: ttt.XPolicy = (b) => {
        const ms = ttt.moves(b);
        const best = Math.max(...ms.map((i) => M.get(ttt.play(b, i, "X"))!));
        return [{ move: ms.find((i) => M.get(ttt.play(b, i, "X")) === best)!, p: 1 }];
      };
      const kinds: ttt.OpponentKind[] = ["random", "defensive"];
      const [r, d] = kinds.map((k) => ({ opt: ttt.optimalWinProbability(k), plain: ttt.evaluatePolicy(firstTie, k).win, safe: ttt.evaluatePolicy(ttt.bestMinimaxSafePolicy(k), k).win }));
      return close(r.opt, 191 / 192, 1e-12) && close(r.plain, r.opt, 1e-12) && close(d.opt, 89 / 96, 1e-12) && close(d.plain, 0.875, 1e-12) && close(d.safe, d.opt, 1e-12) && close(r.safe, r.opt, 1e-12);
    },
  },
  "ch01.ttt-learner-converges": {
    kind: "fact", // p. 13: with the step size reduced over time (1/n per position) the values approach the true probabilities of winning under
    // optimal play. After 30,000 games against the random opponent (ε = 0.1, seed 1) the ten most-updated values are within 0.01 RMS of them,
    // and the greedy policy wins within 0.01 of the best possible probability
    run: () => {
      const k: ttt.OpponentKind = "random";
      const W = ttt.optimalAfterstateValues(k);
      const cfg: ttt.TttSettings = { epsilon: 0.1, alpha: "1/n" };
      const L = ttt.newLearner();
      ttt.trainTicTacToe(L, k, cfg, 30_000, makeRng(1));
      const top = [...L.n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      const rms = Math.sqrt(top.reduce((a, [s]) => a + (L.V.get(s)! - W.get(s)!) ** 2, 0) / top.length);
      return rms < 0.01 && ttt.learnedPolicyResult(L, k, cfg).win > ttt.optimalWinProbability(k) - 0.01;
    },
  },
  "ch01.ttt-exploration-values": {
    kind: "fact", // Exercise 1.4: without learning from exploratory moves the values approach the optimal-play probabilities; learning from
    // them too, they approach the probabilities under the ε-greedy policy instead (30,000 games, 1/n, seed 1, ten most-updated positions)
    run: () => {
      const k: ttt.OpponentKind = "random";
      const W = ttt.optimalAfterstateValues(k);
      const opt = ttt.greedyPolicy((s) => (ttt.isTerminal(s) ? ttt.terminalValue(s) : W.get(s)!));
      const Vopt = ttt.afterstateValuesUnder(opt, k);
      const Veps = ttt.afterstateValuesUnder(ttt.epsilonGreedyOf(opt, 0.1), k);
      const errs = (learnFromExploration: boolean) => {
        const L = ttt.newLearner();
        ttt.trainTicTacToe(L, k, { epsilon: 0.1, alpha: "1/n", learnFromExploration }, 30_000, makeRng(1));
        const top = [...L.n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
        const e = (f: (s: string) => number) => Math.sqrt(top.reduce((a, [s]) => a + (L.V.get(s)! - f(s)) ** 2, 0) / top.length);
        return [e(Vopt), e(Veps)];
      };
      const [a, b] = errs(false);
      const [c, d] = errs(true);
      return a < 0.01 && a < b && d < c && d < 0.02 && Veps(ttt.play(ttt.EMPTY, 0, "X")) < Vopt(ttt.play(ttt.EMPTY, 0, "X"));
    },
  },
  "ch01.ttt-greedy-worse": {
    kind: "fact", // Exercise 1.3: a purely greedy learner (ε = 0) ends up with a worse greedy policy than one that explores (ε = 0.1):
    // mean over seeds 1–4 after 10,000 games, against both opponents
    run: () => {
      const mean = (k: ttt.OpponentKind, epsilon: number) =>
        [1, 2, 3, 4].reduce((a, s) => {
          const L = ttt.newLearner();
          const cfg: ttt.TttSettings = { epsilon, alpha: 0.1 };
          ttt.trainTicTacToe(L, k, cfg, 10_000, makeRng(s));
          return a + ttt.learnedPolicyResult(L, k, cfg).win / 4;
        }, 0);
      return mean("random", 0) < mean("random", 0.1) - 0.02 && mean("defensive", 0) < mean("defensive", 0.1);
    },
  },
  "ch01.ttt-symmetries-faster": {
    kind: "fact", // Exercise 1.2: one value per symmetry class learns faster early on: mean over seeds 1–8 after 1,000 games, both opponents
    run: () => {
      const mean = (k: ttt.OpponentKind, symmetries: boolean) =>
        [1, 2, 3, 4, 5, 6, 7, 8].reduce((a, s) => {
          const L = ttt.newLearner();
          const cfg: ttt.TttSettings = { epsilon: 0.1, alpha: 0.1, symmetries };
          ttt.trainTicTacToe(L, k, cfg, 1000, makeRng(s));
          return a + ttt.learnedPolicyResult(L, k, cfg).win / 8;
        }, 0);
      return mean("random", true) > mean("random", false) && mean("defensive", true) > mean("defensive", false);
    },
  },
  "ch01.ttt-self-play": {
    kind: "fact", // Exercise 1.1: after 30,000 self-play games (ε = 0.1, α = 0.1, seeds 1–2) X's greedy policy draws against a perfect
    // opponent; a learner trained for 30,000 games against the random opponent (seed 2) loses to one
    run: () => {
      const cfg: ttt.TttSettings = { epsilon: 0.1, alpha: 0.1 };
      const selfOk = [1, 2].every((s) => {
        const X = ttt.newLearner();
        ttt.selfPlay(X, ttt.newLearner(), cfg, 30_000, makeRng(s));
        return ttt.worstCaseAgainstPerfect(ttt.greedyPolicy((b) => ttt.learnerValue(X, b, cfg))) === "draw";
      });
      const L = ttt.newLearner();
      ttt.trainTicTacToe(L, "random", cfg, 30_000, makeRng(2));
      return selfOk && ttt.worstCaseAgainstPerfect(ttt.greedyPolicy((b) => ttt.learnerValue(L, b, cfg))) === "loss";
    },
  },
  "ch01-q015": {
    kind: "answer", // the §1.5 backup V(s) ← V(s) + α[V(s′) − V(s)] with V(s) = 0.5, V(s′) = 0.8, α = 0.1
    run: () => [0.5 + 0.1 * (0.8 - 0.5)],
  },
  "ch01-q017": {
    kind: "answer", // reachable positions (X first, stopping at a win or a full board) and their classes under the 8 symmetries
    run: () => {
      const all = ttt.reachablePositions();
      return [all.size, new Set([...all].map(ttt.canonical)).size];
    },
  },
  // ----- Chapter 6, Milestone 4G -----
  "ch06.driving-home": {
    kind: "fact", // Example 6.1 (table on p. 146): actual times to go are the returns; at "exiting highway" the MC error is 23 − 15 = 8,
    // so α = 1/2 raises the prediction by 4; the TD errors are the changes in predicted total time, and they sum to the MC error
    run: () => {
      const elapsed = [0, 5, 20, 30, 40, 43];
      const toGo = [30, 35, 15, 10, 3, 0];
      const total = elapsed.map((e, i) => e + toGo[i]);
      const actual = elapsed.map((e) => 43 - e); // the return from each state (γ = 1, rewards are elapsed minutes)
      const mcErr = actual.map((g, i) => g - toGo[i]);
      const tdErr = toGo.slice(0, -1).map((v, i) => elapsed[i + 1] - elapsed[i] + toGo[i + 1] - v); // R + V(S′) − V(S)
      const sumsMatch = mcErr.slice(0, -1).every((e, i) => close(e, tdErr.slice(i).reduce((a, b) => a + b, 0), 1e-12));
      return mcErr[2] === 8 && 0.5 * mcErr[2] === 4 && tdErr.every((d, i) => d === total[i + 1] - total[i]) && sumsMatch;
    },
  },
  "ch06.first-episode": {
    kind: "fact", // Exercise 6.2 (Figure 6.6): from V = 0.5 with α = 0.1, an episode that ends on the left changes only V(A), by −0.05;
    // one that ends on the right changes only V(E), by +0.05
    run: () => {
      const m = randomWalk();
      const run = (path: number[], end: number, reward: number) => {
        const V = m.states.map((_, s) => (m.terminal[s] ? 0 : 0.5));
        for (let k = 0; k < path.length; k++) td0Update(V, m, path[k], k === path.length - 1 ? reward : 0, k === path.length - 1 ? end : path[k + 1], 0.1, 1);
        return V;
      };
      const left = run([3, 2, 1], 0, 0);
      const right = run([3, 4, 5], 6, 1);
      return left.every((x, s) => (s === 1 ? close(x, 0.45) : close(x, m.terminal[s] ? 0 : 0.5))) && right.every((x, s) => (s === 5 ? close(x, 0.55) : close(x, m.terminal[s] ? 0 : 0.5)));
    },
  },
  "ch06.random-walk-true-values": {
    kind: "fact", // Exercise 6.5: the true values 1/6 … 5/6 follow both from solving the Bellman equations and from iterative policy evaluation
    run: () => {
      const m = randomWalk();
      const pi = equiprobablePolicy(m);
      const exact = solveExact(m, pi, 1)!;
      const iter = iterativePolicyEvaluation(m, pi, 1, { theta: 1e-13 }).v;
      return [1, 2, 3, 4, 5].every((s) => close(exact[s], s / 6, 1e-12) && close(iter[s], s / 6, 1e-9) && close(RANDOM_WALK_TRUE[s], s / 6, 1e-12));
    },
  },
  "ch06.td-high-alpha-dip": {
    kind: "fact", // Exercise 6.4 (Figure 6.7): TD(0) with α = 0.15 from V = 0.5 reaches its lowest RMS error early (before episode 50, 100 runs)
    // and ends higher; started from V = 0 instead, the dip disappears (the minimum is within 0.005 of the final error)
    run: () => {
      const m = randomWalk();
      const pi = equiprobablePolicy(m);
      const curve = (v0: number) => {
        const c = new Array(101).fill(0);
        for (let r = 0; r < 100; r++) runTd0(m, pi, RANDOM_WALK_START, 0.15, 1, 100, makeRng(300 + r), v0).history.forEach((V, n) => (c[n] += rmsError(V, RANDOM_WALK_TRUE, [1, 2, 3, 4, 5]) / 100));
        return c;
      };
      const half = curve(0.5);
      const zero = curve(0);
      const minHalf = Math.min(...half);
      return half.indexOf(minHalf) < 50 && half[100] > minHalf + 0.008 && zero[100] - Math.min(...zero) < 0.005;
    },
  },
  "ch06.fig6-8": {
    kind: "fact", // Example 6.3, Figure 6.8: batch TD(0) converges to the certainty-equivalence estimate (checked by iterating on a batch), batch MC
    // to the sample averages; over 100 runs batch TD has lower RMS error than batch MC at every batch size from 5 to 100 episodes, near the
    // figure's values at 100 episodes (TD about 0.035, MC about 0.05)
    run: () => {
      const m = randomWalk();
      const pi = equiprobablePolicy(m);
      const v0 = m.states.map((_, s) => (m.terminal[s] ? 0 : 0.5));
      const rng0 = makeRng(9);
      const batch: Episode[] = Array.from({ length: 20 }, () => generateEpisode(m, pi, RANDOM_WALK_START, rng0).steps);
      const td = batchUpdate(batch, m.terminal, "td", 0.001, 1, v0).V;
      const mc = batchUpdate(batch, m.terminal, "mc", 0.001, 1, v0).V;
      const ce = certaintyEquivalence(batch, m.terminal, 1);
      const avg = sampleAverageReturns(batch, m.states.length, 1);
      const converge = [1, 2, 3, 4, 5].every((s) => close(td[s], ce[s], 1e-6) && close(mc[s], avg[s], 1e-6));
      const inner = [1, 2, 3, 4, 5];
      const fill = (V: number[]) => V.map((x) => (Number.isNaN(x) ? 0.5 : x));
      const tdC = new Array(100).fill(0);
      const mcC = new Array(100).fill(0);
      for (let r = 0; r < 100; r++) {
        const rng = makeRng(600 + r);
        const data: Episode[] = [];
        for (let n = 0; n < 100; n++) {
          data.push(generateEpisode(m, pi, RANDOM_WALK_START, rng).steps);
          tdC[n] += rmsError(fill(certaintyEquivalence(data, m.terminal, 1)), RANDOM_WALK_TRUE, inner) / 100;
          mcC[n] += rmsError(fill(sampleAverageReturns(data, m.states.length, 1)), RANDOM_WALK_TRUE, inner) / 100;
        }
      }
      const below = tdC.slice(4).every((x, i) => x < mcC[i + 4]);
      return converge && below && tdC[99] > 0.025 && tdC[99] < 0.045 && mcC[99] > 0.04 && mcC[99] < 0.07;
    },
  },
  "ch06.you-are-the-predictor": {
    kind: "fact", // Example 6.4: on the eight episodes, batch TD(0) gives V(A) = V(B) = 3/4; batch MC gives V(A) = 0, V(B) = 3/4
    run: () => {
      const terminal = [false, false, true]; // A, B, terminal
      const step = (s: number, r: number, next: number) => ({ t: 0, s, a: 0, r, next });
      const eps: Episode[] = [[step(0, 0, 1), step(1, 0, 2)], ...Array.from({ length: 6 }, () => [step(1, 1, 2)]), [step(1, 0, 2)]];
      const td = batchUpdate(eps, terminal, "td", 0.01, 1, [0, 0, 0]).V;
      const mc = batchUpdate(eps, terminal, "mc", 0.01, 1, [0, 0, 0]).V;
      return close(td[0], 0.75, 1e-6) && close(td[1], 0.75, 1e-6) && close(mc[0], 0, 1e-6) && close(mc[1], 0.75, 1e-6);
    },
  },
  "ch06-q007": {
    kind: "answer", // Exercises 6.6–6.7: the optimal expected episode length from S, by value iteration: standard moves, king's moves,
    // king's moves with "stay", king's moves with stochastic wind
    run: () => [windyGridworld(), windyVariant(), windyVariant({ stay: true })].map((m) => -valueIteration(m, 1, { theta: 1e-12 }).v[m.grid.start]),
  },
  "ch06-q008": {
    kind: "answer", // Exercise 6.7: king's moves with stochastic wind (±1 with probability 1/3 each, in windy columns only)
    run: () => {
      const m = windyVariant({ stochastic: true });
      return [-valueIteration(m, 1, { theta: 1e-12 }).v[m.grid.start]];
    },
  },
  "ch06-q009": {
    kind: "answer", // Exercise 6.2: the first episode of Figure 6.6 ended on the left; only V(A) changes, from 0.5
    run: () => {
      const m = randomWalk();
      const V = m.states.map((_, s) => (m.terminal[s] ? 0 : 0.5));
      for (const [s, r, next] of [[3, 0, 2], [2, 0, 1], [1, 0, 0]]) td0Update(V, m, s, r, next, 0.1, 1);
      return [V[1] - 0.5, V[1]];
    },
  },
  "ch06-q017": {
    kind: "answer", // Example 6.1: TD error leaving the office, MC error exiting the highway, and the α = 1/2 increment
    run: () => {
      const td = 5 + 35 - 30;
      const mc = 43 - 20 - 15;
      return [td, mc, 0.5 * mc];
    },
  },
  "ch06-q019": {
    kind: "answer", // Example 6.4: V(A) under batch TD(0) and under batch MC
    run: () => {
      const terminal = [false, false, true];
      const step = (s: number, r: number, next: number) => ({ t: 0, s, a: 0, r, next });
      const eps: Episode[] = [[step(0, 0, 1), step(1, 0, 2)], ...Array.from({ length: 6 }, () => [step(1, 1, 2)]), [step(1, 0, 2)]];
      return [batchUpdate(eps, terminal, "td", 0.01, 1, [0, 0, 0]).V[0], batchUpdate(eps, terminal, "mc", 0.01, 1, [0, 0, 0]).V[0]];
    },
  },
  "lab.mdp.gridworld-exact": {
    kind: "fact", // solving (4.4) exactly gives the k = ∞ grid of Figure 4.2: −14, −18, −20, −22
    run: () => {
      const v = solveExact(grid, random, 1);
      return v !== null && toCells(v).every((x, i) => close(x, FIG_4_2.inf[i], 1e-9));
    },
  },
  "lab.mdp.recycling-consistent": {
    kind: "fact", // Example 3.7 with sample numbers: exact solution = iterative policy evaluation, and it satisfies (3.12)
    run: () =>
      [{ alpha: 0.9, beta: 0.6, rSearch: 2, rWait: 1 }, { alpha: 0.5, beta: 0.2, rSearch: 5, rWait: 0.5 }].every((p) => {
        const m = recyclingRobot(p);
        const pi = recyclingRandomPolicy();
        const exact = solveExact(m, pi, 0.9)!;
        const it = iterativePolicyEvaluation(m, pi, 0.9, { theta: 1e-13 }).v;
        return exact.every((x, s) => close(x, it[s], 1e-8)) && bellmanResidual(m, exact, pi, 0.9) < 1e-9;
      }),
  },
  "lab.mdp.no-termination-detected": {
    kind: "fact", // p. 90: v_π exists if γ < 1 or termination is guaranteed; a policy that can loop forever with γ = 1 has no solution
    run: () => {
      const loop: FiniteMDP = { states: ["a", "T"], terminal: [false, true], actions: ["stay", "end"], dynamics: [[[{ next: 0, reward: -1, prob: 1 }], [{ next: 1, reward: 0, prob: 1 }]], [[], []]] };
      return solveExact(loop, [[1, 0], [0, 0]], 1) === null && solveExact(loop, [[0.5, 0.5], [0, 0]], 1)![0] === -1 && solveExact(loop, [[1, 0], [0, 0]], 0.9) !== null;
    },
  },
  "lab.bellman.ex3-9": {
    kind: "fact", // the Bellman lab's preset is Exercise 3.9: reward part 0, discounted future 0.675
    run: () => {
      const mdp: FiniteMDP = { states: ["c", "n1", "n2", "n3", "n4"], terminal: [false, true, true, true, true], actions: ["n", "s", "e", "w"], dynamics: [[1, 2, 3, 4].map((next) => [{ next, reward: 0, prob: 1 }]), [], [], [], []] };
      const b = backupTerms(mdp, [0, 2.3, 0.4, -0.4, 0.7], equiprobablePolicy(mdp), 0, 0.9);
      return b.terms.length === 4 && close(b.reward, 0) && close(b.future, 0.675, 1e-12) && close(b.total, 0.675, 1e-12);
    },
  },

  // ----- Laboratories, Milestone 3E: dynamic programming, Monte Carlo and TD -----
  "lab.dp.gridworld-optimal": {
    kind: "fact", // §4.2–4.4: the optimal values of Example 4.1 are minus the steps to the nearest corner (−1, −2, −3, p. 96);
    // value iteration and policy iteration (from the random policy) both reach them, policy iteration after one improvement.
    run: () => {
      const want = [0, -1, -2, -3, -1, -2, -3, -2, -2, -3, -2, -1, -3, -2, -1, 0];
      const vi = valueIteration(grid, 1);
      const pi = policyIteration(grid, 1);
      return toCells(vi.v).every((x, i) => close(x, want[i])) && pi.stable && pi.steps.length === 2 && toCells(pi.steps[1].v).every((x, i) => close(x, want[i], 1e-9));
    },
  },
  "lab.dp.gambler-bold-play": {
    kind: "fact", // Example 4.3 with p_h = 0.4: for p_h < 1/2 bold play is optimal, so v*(25) = 0.16, v*(50) = 0.4, v*(75) = 0.64,
    // and staking everything at $50 is among the maximizing stakes (Figure 4.6 shows a stake of 50 there).
    run: () => {
      const g = gamblersProblem(0.4);
      const vi = valueIteration(g, 1, { theta: 1e-13 });
      return close(vi.v[25], 0.16, 1e-9) && close(vi.v[50], 0.4, 1e-9) && close(vi.v[75], 0.64, 1e-9) && vi.policy.ties[50].includes(50);
    },
  },
  "lab.dp.recycling-optimal-consistent": {
    kind: "fact", // policy iteration and value iteration agree on the recycling robot (Example 3.7, sample numbers), γ = 0.9
    run: () => {
      const m = recyclingRobot({ alpha: 0.9, beta: 0.6, rSearch: 2, rWait: 1 });
      const pi = policyIteration(m, 0.9);
      const vi = valueIteration(m, 0.9, { theta: 1e-13 });
      return pi.stable && pi.steps.at(-1)!.v.every((x, s) => close(x, vi.v[s], 1e-7));
    },
  },
  "lab.mc.random-walk-converges": {
    kind: "fact", // §5.1: first-visit and every-visit MC estimates converge to v_π; on Example 6.2, v = 1/6 … 5/6
    run: () => {
      const rw = randomWalk();
      const pol = equiprobablePolicy(rw);
      const states = [1, 2, 3, 4, 5];
      const fv = runMcPrediction(rw, pol, RANDOM_WALK_START, 1, 2000, makeRng(31)).state.V;
      const ev = runMcPrediction(rw, pol, RANDOM_WALK_START, 1, 2000, makeRng(32), { firstVisit: false }).state.V;
      return rmsError(fv, RANDOM_WALK_TRUE, states) < 0.03 && rmsError(ev, RANDOM_WALK_TRUE, states) < 0.03;
    },
  },
  "lab.mc.es-blackjack": {
    kind: "fact", // Example 5.3: Monte Carlo ES on blackjack, from "stick only on 20 or 21", learns the optimal policy (Figure 5.5).
    // 500,000 episodes: at least 195 of the 200 states agree with the exact optimum, and every state whose two
    // action values differ by more than 0.1 agrees. Closer decisions can still be wrong: each Q(s, a) averages all its
    // returns, including those earned under earlier, worse policies, and with ~1500–2500 returns per pair the error of
    // a difference of two Q values is about 0.03–0.04 (seeds 1–3 miss states with gaps of 0.04–0.06). Every episode
    // ends, so none is cut off.
    run: () => {
      const m = blackjack();
      const vi = valueIteration(m, 1, { theta: 1e-12 });
      const q = (i: number, a: number) => actionValue(m, vi.v, i, a, 1);
      const r = runEs(m, 500_000, 1, makeRng(1), { starts: bjStartPairs(), policy0: stickOn20().map((row) => row.indexOf(1)) });
      let agree = 0;
      let clearWrong = 0;
      for (let i = 1; i <= 200; i++) {
        const best = q(i, BJ_STICK) >= q(i, BJ_HIT) ? BJ_STICK : BJ_HIT;
        if (r.state.policy[i] === best) agree++;
        else if (Math.abs(q(i, BJ_STICK) - q(i, BJ_HIT)) > 0.1) clearWrong++;
      }
      return r.truncated === 0 && agree >= 195 && clearWrong === 0;
    },
  },
  "lab.mc.es-needs-termination": {
    kind: "fact", // pp. 122 and 157: Monte Carlo ES assumes episodes end. On the gridworld a greedy policy can loop for ever; with
    // cut-off episodes discarded (they are not samples of the return), most episodes are lost and the policy stops improving.
    run: () => {
      const r = runEs(grid, 5000, 1, makeRng(1), { maxSteps: 50 });
      const opt = valueIteration(grid, 1).policy.ties;
      return r.truncated > 2500 && !r.state.policy.every((a, s) => grid.terminal[s] || opt[s].includes(a));
    },
  },
  "lab.td.random-walk-start": {
    kind: "fact", // Example 6.2 with V = 0.5 everywhere: the RMS error over A–E is √(1/18) ≈ 0.236, where Figure 6.7's curves start
    run: () => close(rmsError([0, 0.5, 0.5, 0.5, 0.5, 0.5, 0], RANDOM_WALK_TRUE, [1, 2, 3, 4, 5]), Math.sqrt(1 / 18), 1e-12),
  },
  "lab.td.fig6-7": {
    kind: "fact", // Figure 6.7: averaged over 100 sequences, TD(0) is better than constant-α MC after 100 episodes, for the α shown
    run: () => {
      const rw = randomWalk();
      const pol = equiprobablePolicy(rw);
      const states = [1, 2, 3, 4, 5];
      const at100 = (f: (seed: number) => number[]) => {
        let s = 0;
        for (let r = 1; r <= 100; r++) s += rmsError(f(r), RANDOM_WALK_TRUE, states);
        return s / 100;
      };
      const td = Math.min(...[0.05, 0.1, 0.15].map((a) => at100((seed) => runTd0(rw, pol, RANDOM_WALK_START, a, 1, 100, makeRng(seed), 0.5).V)));
      const mcErr = Math.min(...[0.01, 0.02, 0.03, 0.04].map((a) => at100((seed) => runMcPrediction(rw, pol, RANDOM_WALK_START, 1, 100, makeRng(1000 + seed), { alpha: a, v0: 0.5, firstVisit: false }).state.V)));
      return td < mcErr;
    },
  },
  "lab.td.windy-fig6-11": {
    kind: "fact", // Example 6.5: the shortest path takes 15 steps; ε-greedy Sarsa (ε = 0.1, α = 0.5, Q = 0) completes
    // roughly 170 episodes in its first 8000 steps (Figure 6.11). Checked range: 130–200 over three seeds.
    run: () => {
      const w = windyGridworld();
      const counts = [1, 2, 3].map((seed) => runControl(w, w.grid.start, { method: "sarsa", alpha: 0.5, epsilon: 0.1, gamma: 1 }, makeRng(seed), { maxTotalSteps: 8000 }).rewards.length);
      return close(valueIteration(w, 1).v[w.grid.start], -15) && counts.every((c) => c >= 130 && c <= 200);
    },
  },
  "lab.td.cliff-fig6-13": {
    kind: "fact", // Example 6.6 (ε = 0.1): Q-learning learns the optimal path along the cliff (13 steps) but earns less per
    // episode online than Sarsa, which learns a longer, safer path (Figure 6.13: about −50 against about −25). 20 runs, α = 0.5.
    run: () => {
      const c = cliffWalking();
      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      const out = { sarsa: [] as number[], q: [] as number[], qPath: [] as number[], sPath: [] as number[] };
      for (let seed = 1; seed <= 20; seed++) {
        const s = runControl(c, c.grid.start, { method: "sarsa", alpha: 0.5, epsilon: 0.1, gamma: 1 }, makeRng(seed), { episodes: 500 });
        const q = runControl(c, c.grid.start, { method: "q-learning", alpha: 0.5, epsilon: 0.1, gamma: 1 }, makeRng(seed), { episodes: 500 });
        out.sarsa.push(mean(s.rewards.slice(100)));
        out.q.push(mean(q.rewards.slice(100)));
        out.qPath.push((greedyPath(c, q.Q, c.grid.start) ?? []).length - 1);
        out.sPath.push((greedyPath(c, s.Q, c.grid.start) ?? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).length - 1);
      }
      return mean(out.sarsa) > mean(out.q) + 10 && out.qPath.every((n) => n === 13) && out.sPath.filter((n) => n > 13).length >= 15;
    },
  },

  // ----- Blackjack, Examples 5.1, 5.3, 5.4 (Milestone 4B) -----
  "bj.dynamics": {
    kind: "fact", // the exact blackjack model: every p(·, · | s, a) sums to 1, and every state's actions are stick and hit (the deal state deals)
    run: () => {
      const m = blackjack();
      const sums = m.dynamics.flatMap((row) => row.filter((o) => o.length).map((o) => o.reduce((x, y) => x + y.prob, 0)));
      return sums.every((x) => close(x, 1, 1e-12)) && m.dynamics.slice(1, 201).every((row) => row[BJ_STICK].length > 0 && row[BJ_HIT].length > 0 && row[2].length === 0);
    },
  },
  "bj.example-5-4": {
    kind: "fact", // Example 5.4 (p. 130): under "stick only on 20 or 21", the state (dealer 2, sum 13, usable ace) has value
    // approximately −0.27726, which the draft estimated from 10^8 episodes. Solved exactly here: −0.27720.
    run: () => close(solveExact(blackjack(), stickOn20(), 1)![bjIndex(13, 2, true)], -0.27726, 5e-4),
  },
  "bj.figure-5-5": {
    kind: "fact", // Figure 5.5: the optimal policy, read from the page image as the lowest sum at which to stick against each
    // dealer card A, 2, …, 10. Usable ace: 19, 18 ×7, 19, 19 (the "notch" against an ace); no usable ace: 17, 13, 13, 12, 12, 12, 17 ×4.
    // Value iteration on the exact model gives the same policy, including the notch the draft says Thorp's strategy lacks.
    run: () => {
      const m = blackjack();
      const vi = valueIteration(m, 1, { theta: 1e-12 });
      const stickFrom = (d: number, usable: boolean) => {
        let low = 22;
        for (let sum = 21; sum >= 12; sum--) {
          const i = bjIndex(sum, d, usable);
          if (actionValue(m, vi.v, i, BJ_STICK, 1) >= actionValue(m, vi.v, i, BJ_HIT, 1)) low = sum;
          else break;
        }
        // and below that sum, hitting is strictly better (a threshold policy)
        for (let sum = 12; sum < low; sum++) {
          const i = bjIndex(sum, d, usable);
          if (!(actionValue(m, vi.v, i, BJ_HIT, 1) > actionValue(m, vi.v, i, BJ_STICK, 1))) return -1;
        }
        return low;
      };
      const usable = Array.from({ length: 10 }, (_, k) => stickFrom(k + 1, true));
      const hard = Array.from({ length: 10 }, (_, k) => stickFrom(k + 1, false));
      return JSON.stringify(usable) === JSON.stringify([19, 18, 18, 18, 18, 18, 18, 18, 19, 19]) && JSON.stringify(hard) === JSON.stringify([17, 13, 13, 12, 12, 12, 17, 17, 17, 17]);
    },
  },
  "lab.td.windy-17-steps": {
    kind: "fact", // Example 6.5 (p. 157): "continued ε-greedy exploration kept the average episode length at about 17 steps, two
    // more than the minimum of 15". Exactly: the ε-greedy (ε = 0.1) policy on q* takes 17.05 steps on average.
    run: () => {
      const w = windyGridworld();
      const vi = valueIteration(w, 1, { theta: 1e-12 });
      const nA = w.actions.length;
      const pi = w.states.map((_, s) => {
        if (w.terminal[s]) return w.actions.map(() => 0);
        const q = w.actions.map((_, a) => actionValue(w, vi.v, s, a, 1));
        const best = q.map((x, a) => [x, a]).filter(([x]) => Math.abs(x - Math.max(...q)) < 1e-9).map(([, a]) => a);
        return w.actions.map((_, a) => 0.1 / nA + (best.includes(a) ? 0.9 / best.length : 0));
      });
      const len = -solveExact(w, pi, 1)![w.grid.start];
      return close(len, 17.05, 0.01);
    },
  },
  "lab.td.windy-sarsa-settles": {
    kind: "fact", // D-043: with α = 0.1 (and ε = 0.1, Q = 0), Sarsa's episodes settle at about 17 steps, the exact 17.05 above,
    // within 150,000 steps. With the draft's α = 0.5 they stay near 19 (the large step keeps the greedy policy moving).
    run: () => {
      const w = windyGridworld();
      return [1, 2, 3].every((seed) => {
        const r = runControl(w, w.grid.start, { method: "sarsa", alpha: 0.1, epsilon: 0.1, gamma: 1 }, makeRng(seed), { maxTotalSteps: 150_000 });
        const ls = r.lengths.filter((_, k) => r.endedAt[k] > 140_000);
        const mean = ls.reduce((a, b) => a + b, 0) / ls.length;
        return mean > 16.6 && mean < 17.8;
      });
    },
  },

  // ----- Explainer worked examples (Milestone 3F) -----
  "alg.gradient-bandit-example": {
    kind: "fact", // (2.10) with H = (0, 0, 0), α = 0.1, A_t = arm 1, R_t = 3, R̄_t = 1: H becomes (2/15, −1/15, −1/15)
    run: () => {
      const pi = softmax([0, 0, 0]);
      const d = 0.1 * (3 - 1);
      const h = [0 + d * (1 - pi[0]), 0 - d * pi[1], 0 - d * pi[2]];
      const after = softmax(h);
      return close(h[0], 2 / 15) && close(h[1], -1 / 15) && close(after[0], Math.exp(0.2) / (Math.exp(0.2) + 2), 1e-12) && close(after.reduce((a, b) => a + b, 0), 1);
    },
  },
  "alg.mc-example": {
    kind: "fact", // the episode C, B, C, D, E → right with γ = 0.9: first-visit V(C) = 0.9⁴ = 0.6561; every-visit V(C) = (0.9⁴ + 0.9²)/2
    run: () => {
      const ep = [3, 2, 3, 4, 5].map((s, t, xs) => ({ t, s, a: 0, r: t === 4 ? 1 : 0, next: t < 4 ? xs[t + 1] : 6 }));
      const fv = mcUpdate(newPrediction(7), ep, 0.9, true).state.V;
      const ev = mcUpdate(newPrediction(7), ep, 0.9, false).state.V;
      return close(fv[3], 0.6561) && close(ev[3], (0.6561 + 0.81) / 2) && close(fv[2], 0.729) && close(fv[5], 1);
    },
  },
  "alg.td0-example": {
    kind: "fact", // random walk, V = 0.5 everywhere, α = 0.1: the step E → right end (reward 1) makes V(E) = 0.55; then D → E makes V(D) = 0.505
    run: () => {
      const rw = randomWalk();
      const V = [0, 0.5, 0.5, 0.5, 0.5, 0.5, 0];
      const a = td0Update(V, rw, 5, 1, 6, 0.1, 1);
      const b = td0Update(V, rw, 4, 0, 5, 0.1, 1);
      return close(a.after, 0.55) && close(a.delta, 0.5) && close(b.after, 0.505) && close(b.target, 0.55);
    },
  },
  "alg.sarsa-vs-q-example": {
    kind: "fact", // one transition, two targets: Q(S, A) = −2, R = −1, Q(S′, ·) = (−1, −3), γ = 1, α = 0.5. If the ε-greedy next action is the
    // worse one, Sarsa's target is −1 + (−3) = −4 and Q(S, A) → −3; Q-learning's target is −1 + max(−1, −3) = −2 and Q(S, A) stays −2.
    run: () => {
      const m: FiniteMDP = {
        states: ["S", "S'", "T"],
        terminal: [false, false, true],
        actions: ["a", "b"],
        dynamics: [[[{ next: 1, reward: -1, prob: 1 }], [{ next: 1, reward: -1, prob: 1 }]], [[{ next: 2, reward: 0, prob: 1 }], [{ next: 2, reward: 0, prob: 1 }]], [[], []]],
      };
      const st = { ...newControl(m, 0), Q: [[-2, -2], [-1, -3], [0, 0]] };
      // Find a seed whose ε-random choice picks the worse next action, so the two targets differ.
      for (let seed = 1; seed < 200; seed++) {
        const s = sarsaStep(m, st, { method: "sarsa", alpha: 0.5, epsilon: 1, gamma: 1 }, makeRng(seed), 0);
        if (s.detail.nextAction !== 1) continue;
        const q = qLearningStep(m, st, { method: "q-learning", alpha: 0.5, epsilon: 1, gamma: 1 }, makeRng(seed), 0);
        return close(s.detail.target, -4) && close(s.detail.after, -3) && close(q.detail.target, -2) && close(q.detail.after, -2);
      }
      return false;
    },
  },

  // ----- Questions for the algorithm explainers (Milestone 3F) -----
  "ch02-q018": {
    kind: "answer", // (2.10) from H = (0, 0, 0), α = 0.1, arm 1, R = 3, R̄ = 1; then π(1) by (2.9)
    run: () => {
      const pi = softmax([0, 0, 0]);
      const d = 0.1 * (3 - 1);
      const h = pi.map((p, a) => (a === 0 ? d * (1 - p) : -d * p));
      return [h[0], h[1], softmax(h)[0]];
    },
  },
  "ch04-q012": {
    kind: "answer", // policy iteration from the random policy: values of the first improved policy at states 1 and 6
    run: () => {
      const v = policyIteration(gridworld4x4(), 1).steps[1].v;
      return [v[1], v[6]];
    },
  },
  "ch04-q009": {
    kind: "answer", // two sweeps of two-array value iteration on the gridworld from 0
    run: () => {
      const h = valueIteration(gridworld4x4(), 1, { theta: 0, maxSweeps: 2, record: true, mode: "two-array" }).history[2];
      return [h[1], h[6]];
    },
  },
  "ch04-q010": {
    kind: "answer", // gambler's problem, p_h = 0.4
    run: () => {
      const v = valueIteration(gamblersProblem(0.4), 1, { theta: 1e-13 }).v;
      return [v[25], v[50]];
    },
  },
  "ch05-q001": {
    kind: "answer", // the episode C, B, C, D, E → right with γ = 0.9: first-visit V(C), every-visit V(C), V(B)
    run: () => {
      const ep = [3, 2, 3, 4, 5].map((s, t, xs) => ({ t, s, a: 0, r: t === 4 ? 1 : 0, next: t < 4 ? xs[t + 1] : 6 }));
      const fv = mcUpdate(newPrediction(7), ep, 0.9, true).state.V;
      return [fv[3], mcUpdate(newPrediction(7), ep, 0.9, false).state.V[3], fv[2]];
    },
  },
  "ch05-q004": { kind: "answer", run: () => [incrementalAverages([-4, -6, -2], 0).at(-1)!] }, // the average of the three returns, computed incrementally
  "ch06-q001": {
    kind: "answer", // TD(0) on the random walk from V = 0.5, α = 0.1: E → right end, then D → E
    run: () => {
      const rw = randomWalk();
      const V = [0, 0.5, 0.5, 0.5, 0.5, 0.5, 0];
      const a = td0Update(V, rw, 5, 1, 6, 0.1, 1);
      return [a.delta, a.after, td0Update(V, rw, 4, 0, 5, 0.1, 1).after];
    },
  },
  "ch06-q003": {
    kind: "answer", // Sarsa, α = 0.5, γ = 1, when the ε-greedy next action is the one with Q = −3
    run: () => {
      const d = oneTransition("sarsa", 1);
      return [d.target, d.delta, d.after];
    },
  },
  "ch06-q005": {
    kind: "answer", // Q-learning, α = 0.5, γ = 0.9
    run: () => {
      const d = oneTransition("q-learning", 0.9);
      return [d.target, d.delta, d.after];
    },
  },

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
