// Off-policy Monte Carlo (Sutton & Barto, April 2015 draft, §5.5–5.7):
//   - the importance-sampling ratio ρ (5.3), from the two policies only;
//   - ordinary (5.4) and weighted (5.5) importance-sampling estimates of one state's value, episode by episode
//     (Example 5.4, Figure 5.7; Example 5.5, Figure 5.8), with a first-visit or an every-visit variant;
//   - the incremental weighted average (5.6)–(5.7);
//   - off-policy every-visit MC control with weighted importance sampling (Figure 5.10), with one correction:
//     the draft's figure multiplies W by 1/µ(A_t|S_t) and then tests "W = 0", which can never be true, so as printed
//     it would keep weighting the returns that follow a non-greedy action. Here the backward loop stops as soon as
//     A_t is not the greedy action π(S_t), which is what the ratio π(A_t|S_t)/µ(A_t|S_t) = 0 requires (flagged in the
//     content).
import type { Rng } from "../../domain/random";
import type { FiniteMDP, Policy } from "./mdp";
import { generateEpisode, sampleStep, type Step } from "./sampling";

/** ρ_t^T = Π_{k=t}^{T−1} π(A_k|S_k) / µ(A_k|S_k) (5.3) for the steps of an episode from index `from` on. */
export function importanceRatio(steps: readonly Step[], target: Policy, behaviour: Policy, from = 0): number {
  let rho = 1;
  for (let k = from; k < steps.length && rho !== 0; k++) rho *= target[steps[k].s][steps[k].a] / behaviour[steps[k].s][steps[k].a];
  return rho;
}

export interface IsCurves {
  ordinary: Float64Array; // estimate (5.4) after n episodes, n = 1 … episodes
  weighted: Float64Array; // estimate (5.5), 0 while the denominator is 0
}

/**
 * Estimates v_π(start) from episodes that follow µ from `start`, after every episode, by ordinary and weighted
 * importance sampling. First-visit: one (ρ, G) pair per episode, from its first visit to `start` (the start itself).
 * Every-visit: one pair for every visit to `start` within the episode (Exercise 5.6).
 */
export function isEstimates(mdp: FiniteMDP, target: Policy, behaviour: Policy, start: number, episodes: number, gamma: number, rng: Rng, opts: { everyVisit?: boolean } = {}): IsCurves {
  const ordinary = new Float64Array(episodes);
  const weighted = new Float64Array(episodes);
  let sumRhoG = 0;
  let sumRho = 0;
  let count = 0;
  for (let n = 0; n < episodes; n++) {
    const { steps } = generateEpisode(mdp, behaviour, start, rng);
    // Returns and ratios from each step to the end, computed backwards.
    let G = 0;
    let rho = 1;
    for (let t = steps.length - 1; t >= 0; t--) {
      G = gamma * G + steps[t].r;
      rho *= target[steps[t].s][steps[t].a] / behaviour[steps[t].s][steps[t].a];
      const visit = steps[t].s === start && (opts.everyVisit || t === steps.findIndex((x) => x.s === start));
      if (visit) {
        sumRhoG += rho * G;
        sumRho += rho;
        count++;
      }
    }
    ordinary[n] = count ? sumRhoG / count : 0;
    weighted[n] = sumRho ? sumRhoG / sumRho : 0;
  }
  return { ordinary, weighted };
}

/** The incremental weighted average (5.7): V_{n+1} = V_n + (W_n / C_n)(G_n − V_n), C_n = C_{n−1} + W_n, C_0 = 0. */
export function weightedIncremental(returns: readonly number[], weights: readonly number[], v1 = 0): number[] {
  const out = [v1];
  let v = v1;
  let c = 0;
  returns.forEach((g, i) => {
    c += weights[i];
    if (c > 0) v = v + (weights[i] / c) * (g - v);
    out.push(v);
  });
  return out;
}

/** Example 5.5 (Figure 5.8): one nonterminal state s; "back" returns to s with probability 0.9 or ends with +1; "end" ends with 0. */
export function infiniteVarianceMdp(): FiniteMDP {
  return {
    states: ["s", "terminal"],
    terminal: [false, true],
    actions: ["back", "end"],
    dynamics: [
      [
        [
          { next: 0, reward: 0, prob: 0.9 },
          { next: 1, reward: 1, prob: 0.1 },
        ],
        [{ next: 1, reward: 0, prob: 1 }],
      ],
      [[], []],
    ],
  };
}
export const INFINITE_VARIANCE_TARGET: Policy = [[1, 0], [0, 0]];
export const INFINITE_VARIANCE_BEHAVIOUR: Policy = [[0.5, 0.5], [0, 0]];

export interface OffPolicyControlState {
  Q: number[][];
  C: number[][];
  pi: number[]; // the greedy target policy
  episodes: number;
  steps: number;
}

export function newOffPolicyControl(mdp: FiniteMDP, q0 = 0): OffPolicyControlState {
  const Q = mdp.states.map((_, s) => mdp.actions.map((_, a) => (mdp.dynamics[s][a].length ? q0 : -Infinity)));
  return { Q, C: mdp.states.map(() => mdp.actions.map(() => 0)), pi: Q.map(argmaxFirst), episodes: 0, steps: 0 };
}

const availCache = new WeakMap<FiniteMDP, number[][]>();
function availableOf(mdp: FiniteMDP, s: number): number[] {
  let c = availCache.get(mdp);
  if (!c) availCache.set(mdp, (c = mdp.states.map((_, x) => mdp.actions.map((_, a) => a).filter((a) => mdp.dynamics[x][a].length > 0))));
  return c[s];
}

function argmaxFirst(row: readonly number[]): number {
  let best = 0;
  for (let a = 1; a < row.length; a++) if (row[a] > row[best]) best = a;
  return best;
}

/** The ε-greedy behaviour policy µ with respect to the current Q, over the available actions. */
export function epsilonGreedyBehaviour(mdp: FiniteMDP, st: OffPolicyControlState, epsilon: number): Policy {
  return mdp.states.map((_, s) => {
    const avail = mdp.actions.map((_, a) => a).filter((a) => mdp.dynamics[s][a].length > 0);
    return mdp.actions.map((_, a) => (!avail.includes(a) ? 0 : epsilon / avail.length + (a === st.pi[s] ? 1 - epsilon : 0)));
  });
}

/**
 * One episode of off-policy MC control (Figure 5.10, corrected as described in the header), in place. The behaviour
 * is ε-greedy with respect to Q at the start of the episode (any soft policy is allowed).
 */
export function offPolicyControlEpisode(mdp: FiniteMDP, st: OffPolicyControlState, start: number, gamma: number, epsilon: number, rng: Rng, maxSteps = 100_000): { length: number; updated: number } {
  // µ(a|s) = ε/|A(s)| + (1 − ε)·[a = π(s)], with π as it stands at the start of the episode; only the states the
  // episode visits are needed, so µ is evaluated on the way and its probability of the action taken is kept.
  const steps: Step[] = [];
  const muTaken: number[] = [];
  const piAtStart = new Map<number, number>();
  let s = start;
  while (!mdp.terminal[s] && steps.length < maxSteps) {
    if (!piAtStart.has(s)) piAtStart.set(s, st.pi[s]);
    const greedy = piAtStart.get(s)!;
    const avail = availableOf(mdp, s);
    const a = rng() < epsilon ? avail[Math.floor(rng() * avail.length)] : greedy;
    muTaken.push(epsilon / avail.length + (a === greedy ? 1 - epsilon : 0));
    const { next, reward } = sampleStep(mdp, s, a, rng);
    steps.push({ t: steps.length, s, a, r: reward, next });
    s = next;
  }
  let G = 0;
  let W = 1;
  let updated = 0;
  for (let t = steps.length - 1; t >= 0; t--) {
    const { s: S, a: A, r } = steps[t];
    G = gamma * G + r;
    st.C[S][A] += W;
    st.Q[S][A] += (W / st.C[S][A]) * (G - st.Q[S][A]);
    st.pi[S] = argmaxFirst(st.Q[S]);
    updated++;
    if (A !== st.pi[S]) break; // π(A_t|S_t) = 0: earlier steps get ratio 0
    W *= 1 / muTaken[t];
  }
  st.episodes++;
  st.steps += steps.length;
  return { length: steps.length, updated };
}
