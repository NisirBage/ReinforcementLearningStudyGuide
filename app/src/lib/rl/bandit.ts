// Multi-arm bandit estimators and action selection, as in Sutton & Barto (April 2015 draft), Chapter 2.
// Notation follows the draft: n arms, Q_t(a) estimates, N_t(a) counts, step size α.
import type { Rng } from "../../domain/random";

/** Sample-average estimate (2.1): mean of the rewards received for an action; `fallback` when it was never taken. */
export function sampleAverage(rewards: readonly number[], fallback = 0): number {
  return rewards.length ? rewards.reduce((s, r) => s + r, 0) / rewards.length : fallback;
}

/** One application of the general rule (2.4): NewEstimate ← OldEstimate + StepSize [Target − OldEstimate]. */
export const updateEstimate = (old: number, stepSize: number, target: number): number => old + stepSize * (target - old);

/**
 * Incremental sample average (2.3): Q_{k+1} = Q_k + (1/k)[R_k − Q_k], for k = 1, 2, …
 * Returns [Q_1, Q_2, …, Q_{n+1}] for rewards R_1..R_n. Q_2 = R_1 whatever Q_1 is.
 */
export function incrementalAverages(rewards: readonly number[], q1 = 0): number[] {
  const qs = [q1];
  rewards.forEach((r, i) => qs.push(updateEstimate(qs[i], 1 / (i + 1), r)));
  return qs;
}

/** Constant step size (2.5): Q_{k+1} = Q_k + α[R_k − Q_k]. Returns [Q_1, …, Q_{n+1}]. */
export function constantStepEstimates(rewards: readonly number[], alpha: number, q1 = 0): number[] {
  if (!(alpha > 0 && alpha <= 1)) throw new RangeError("α must lie in (0, 1]");
  const qs = [q1];
  rewards.forEach((r, i) => qs.push(updateEstimate(qs[i], alpha, r)));
  return qs;
}

/**
 * Weights of the exponential recency-weighted average (2.6): Q_{k+1} = (1−α)^k Q_1 + Σ_i α(1−α)^{k−i} R_i.
 * Returns { initial: (1−α)^k, rewards: [w_1, …, w_k] }. They sum to 1 (0^0 = 1 when α = 1).
 */
export function recencyWeights(k: number, alpha: number): { initial: number; rewards: number[] } {
  if (!Number.isInteger(k) || k < 0) throw new RangeError("k must be a non-negative integer");
  const pow = (x: number, e: number) => (e === 0 ? 1 : x ** e);
  return { initial: pow(1 - alpha, k), rewards: Array.from({ length: k }, (_, j) => alpha * pow(1 - alpha, k - (j + 1))) };
}

/** The closed form (2.6) evaluated directly, for checking against the recursion (2.5). */
export function recencyWeightedAverage(rewards: readonly number[], alpha: number, q1 = 0): number {
  const w = recencyWeights(rewards.length, alpha);
  return w.initial * q1 + w.rewards.reduce((s, wi, i) => s + wi * rewards[i], 0);
}

/** Indices of the maximal entries (ties kept). */
export function argmaxAll(values: readonly number[]): number[] {
  const m = Math.max(...values);
  return values.flatMap((v, i) => (v === m ? [i] : []));
}

/** Greedy selection (2.2) with ties broken uniformly at random (as in Figure 2.1), or lowest index without an rng. */
export function greedy(q: readonly number[], rng?: Rng): number {
  const best = argmaxAll(q);
  return rng ? best[Math.floor(rng() * best.length)] : best[0];
}

/** ε-greedy: with probability ε choose uniformly among all arms, otherwise act greedily. */
export function epsilonGreedy(q: readonly number[], epsilon: number, rng: Rng): number {
  return rng() < epsilon ? Math.floor(rng() * q.length) : greedy(q, rng);
}

/**
 * Probability of each arm under ε-greedy with uniform tie-breaking among the greedy arms:
 * ε/n for every arm plus (1−ε)/|greedy set| for each greedy arm.
 */
export function epsilonGreedyProbabilities(q: readonly number[], epsilon: number): number[] {
  const best = new Set(argmaxAll(q));
  return q.map((_, i) => epsilon / q.length + (best.has(i) ? (1 - epsilon) / best.size : 0));
}

/**
 * UCB scores (2.8): Q_t(a) + c·sqrt(ln t / N_t(a)). An arm with N_t(a) = 0 counts as maximizing (score +∞).
 * t is the current time step (t ≥ 1).
 */
export function ucbScores(q: readonly number[], counts: readonly number[], t: number, c: number): number[] {
  if (!(c > 0)) throw new RangeError("c must be positive");
  if (!(t >= 1)) throw new RangeError("t must be at least 1");
  return q.map((qa, i) => (counts[i] === 0 ? Infinity : qa + c * Math.sqrt(Math.log(t) / counts[i])));
}

export function ucbSelect(q: readonly number[], counts: readonly number[], t: number, c: number, rng?: Rng): number {
  return greedy(ucbScores(q, counts, t, c), rng);
}

/**
 * Partial sums for the step-size conditions (2.7): Σ α_k and Σ α_k² up to K terms.
 * Used to illustrate which sequences can satisfy Σα = ∞ and Σα² < ∞ (a finite check cannot prove divergence).
 */
export function stepSizeSums(alpha: (k: number) => number, K: number): { sum: number; sumSq: number } {
  let sum = 0;
  let sumSq = 0;
  for (let k = 1; k <= K; k++) {
    const a = alpha(k);
    sum += a;
    sumSq += a * a;
  }
  return { sum, sumSq };
}
