// Temporal-difference methods, Sutton & Barto (April 2015 draft) Chapter 6.
//
//   TD(0) prediction (6.2), Figure 6.1:  V(S) ← V(S) + α[R + γ V(S′) − V(S)]
//   Sarsa (6.5), Figure 6.9:            Q(S, A) ← Q(S, A) + α[R + γ Q(S′, A′) − Q(S, A)], A′ chosen ε-greedily first
//   Q-learning (6.6), Figure 6.12:      Q(S, A) ← Q(S, A) + α[R + γ max_a Q(S′, a) − Q(S, A)]
// Q(terminal, ·) = 0 throughout. Sarsa and Q-learning are kept as separate functions with separate targets; every
// update returns its intermediate values (current value, the bootstrap term, target, TD error, new value).
import type { Rng } from "../../domain/random";
import { argmaxRandom } from "./banditLab";
import type { FiniteMDP, Policy } from "./mdp";
import { sampleAction, sampleStep } from "./sampling";

// ---------- TD(0) prediction ----------

export interface Td0Detail {
  s: number;
  r: number;
  next: number;
  vS: number; // V(S) before
  vNext: number; // V(S′) (0 if terminal)
  target: number; // R + γ V(S′)
  delta: number; // TD error
  after: number; // V(S) after
}

export function td0Update(V: number[], mdp: FiniteMDP, s: number, r: number, next: number, alpha: number, gamma: number): Td0Detail {
  const vNext = mdp.terminal[next] ? 0 : V[next];
  const target = r + gamma * vNext;
  const delta = target - V[s];
  const vS = V[s];
  V[s] = vS + alpha * delta;
  return { s, r, next, vS, vNext, target, delta, after: V[s] };
}

/** Runs TD(0) for `episodes` episodes from `start`; returns V after each episode (and optionally every detail). */
export function runTd0(mdp: FiniteMDP, pi: Policy, start: number, alpha: number, gamma: number, episodes: number, rng: Rng, v0 = 0, record = false) {
  const V = mdp.states.map((_, s) => (mdp.terminal[s] ? 0 : v0));
  const history: number[][] = [[...V]];
  const details: Td0Detail[][] = [];
  for (let e = 0; e < episodes; e++) {
    let s = start;
    const ep: Td0Detail[] = [];
    while (!mdp.terminal[s]) {
      const a = sampleAction(pi, s, rng);
      const { next, reward } = sampleStep(mdp, s, a, rng);
      const d = td0Update(V, mdp, s, reward, next, alpha, gamma);
      if (record) ep.push(d);
      s = next;
    }
    history.push([...V]);
    if (record) details.push(ep);
  }
  return { V, history, details };
}

/** Root mean-squared error over the given states (Figure 6.7 averages over the five nonterminal states). */
export const rmsError = (v: readonly number[], truth: readonly number[], states: readonly number[]) => Math.sqrt(states.reduce((t, s) => t + (v[s] - truth[s]) ** 2, 0) / states.length);

// ---------- Control ----------

export type ControlMethod = "sarsa" | "q-learning";

export interface ControlStepDetail {
  method: ControlMethod;
  t: number; // step within the episode
  s: number; // S_t
  a: number; // A_t
  explored: boolean; // A_t came from the ε branch
  r: number; // R_{t+1}
  next: number; // S_{t+1}
  terminal: boolean; // S_{t+1} is terminal
  nextAction: number | null; // Sarsa: A_{t+1} (chosen before the update); Q-learning: null
  qSA: number; // Q(S_t, A_t) before
  bootstrap: number; // Sarsa: Q(S_{t+1}, A_{t+1}); Q-learning: max_a Q(S_{t+1}, a); 0 at a terminal state
  target: number; // R_{t+1} + γ · bootstrap
  delta: number; // TD error: target − Q(S_t, A_t)
  after: number; // Q(S_t, A_t) after
}

const avail = (mdp: FiniteMDP, s: number) => mdp.actions.map((_, a) => a).filter((a) => mdp.dynamics[s][a].length > 0);

/** ε-greedy with respect to Q at s (ties broken at random), over the available actions. */
export function epsilonGreedyAction(Q: number[][], mdp: FiniteMDP, s: number, epsilon: number, rng: Rng): { a: number; explored: boolean } {
  const av = avail(mdp, s);
  if (epsilon > 0 && rng() < epsilon) return { a: av[Math.floor(rng() * av.length)], explored: true };
  return { a: av[argmaxRandom(av.map((a) => Q[s][a]), rng)], explored: false };
}

export const maxQ = (Q: number[][], mdp: FiniteMDP, s: number) => (mdp.terminal[s] ? 0 : Math.max(...avail(mdp, s).map((a) => Q[s][a])));

export interface ControlConfig {
  method: ControlMethod;
  alpha: number;
  epsilon: number;
  gamma: number;
}

/** State of an agent between steps (so the lab can advance one step at a time). */
export interface ControlState {
  Q: number[][];
  s: number;
  a: number | null; // Sarsa carries A_t chosen at the previous step
  aExplored?: boolean; // whether that carried A_t came from the ε branch
  t: number; // step within the episode
  episode: number;
  episodeReturn: number;
  totalSteps: number;
}

export const newControl = (mdp: FiniteMDP, start: number): ControlState => ({ Q: mdp.states.map(() => mdp.actions.map(() => 0)), s: start, a: null, t: 0, episode: 0, episodeReturn: 0, totalSteps: 0 });

/** One Sarsa step (6.5), Figure 6.9. A_{t+1} is chosen ε-greedily from S_{t+1} before Q(S_t, A_t) is updated. */
export function sarsaStep(mdp: FiniteMDP, st: ControlState, cfg: ControlConfig, rng: Rng, start: number): { state: ControlState; detail: ControlStepDetail; done: boolean } {
  const Q = st.Q.map((r) => [...r]);
  let explored = st.aExplored ?? false;
  let a = st.a;
  if (a === null) ({ a, explored } = epsilonGreedyAction(Q, mdp, st.s, cfg.epsilon, rng));
  const { next, reward } = sampleStep(mdp, st.s, a, rng);
  const terminal = mdp.terminal[next];
  const choice = terminal ? null : epsilonGreedyAction(Q, mdp, next, cfg.epsilon, rng);
  const bootstrap = terminal ? 0 : Q[next][choice!.a];
  const qSA = Q[st.s][a];
  const target = reward + cfg.gamma * bootstrap;
  const delta = target - qSA;
  Q[st.s][a] = qSA + cfg.alpha * delta;
  const detail: ControlStepDetail = { method: "sarsa", t: st.t, s: st.s, a, explored, r: reward, next, terminal, nextAction: choice ? choice.a : null, qSA, bootstrap, target, delta, after: Q[st.s][a] };
  const out = advance(st, Q, next, choice ? choice.a : null, reward, terminal, start, detail);
  if (choice) out.state.aExplored = choice.explored;
  return out;
}

/** One Q-learning step (6.6), Figure 6.12. A_t is chosen ε-greedily at S_t; the target uses max_a Q(S_{t+1}, a). */
export function qLearningStep(mdp: FiniteMDP, st: ControlState, cfg: ControlConfig, rng: Rng, start: number): { state: ControlState; detail: ControlStepDetail; done: boolean } {
  const Q = st.Q.map((r) => [...r]);
  const { a, explored } = epsilonGreedyAction(Q, mdp, st.s, cfg.epsilon, rng);
  const { next, reward } = sampleStep(mdp, st.s, a, rng);
  const terminal = mdp.terminal[next];
  const bootstrap = maxQ(Q, mdp, next);
  const qSA = Q[st.s][a];
  const target = reward + cfg.gamma * bootstrap;
  const delta = target - qSA;
  Q[st.s][a] = qSA + cfg.alpha * delta;
  const detail: ControlStepDetail = { method: "q-learning", t: st.t, s: st.s, a, explored, r: reward, next, terminal, nextAction: null, qSA, bootstrap, target, delta, after: Q[st.s][a] };
  return advance(st, Q, next, null, reward, terminal, start, detail);
}

function advance(st: ControlState, Q: number[][], next: number, nextA: number | null, reward: number, terminal: boolean, start: number, detail: ControlStepDetail) {
  const ret = st.episodeReturn + reward;
  const state: ControlState = terminal
    ? { Q, s: start, a: null, t: 0, episode: st.episode + 1, episodeReturn: 0, totalSteps: st.totalSteps + 1 }
    : { Q, s: next, a: nextA, t: st.t + 1, episode: st.episode, episodeReturn: ret, totalSteps: st.totalSteps + 1 };
  return { state, detail: { ...detail }, done: terminal, episodeReturn: ret };
}

export const controlStep = (mdp: FiniteMDP, st: ControlState, cfg: ControlConfig, rng: Rng, start: number) => (cfg.method === "sarsa" ? sarsaStep(mdp, st, cfg, rng, start) : qLearningStep(mdp, st, cfg, rng, start));

/**
 * Runs whole episodes (or until `maxTotalSteps`): per-episode sum of rewards and length, and the time step at which
 * each episode ended (Figure 6.11 plots episodes against time steps). `maxEpisodeSteps` guards against an episode
 * that never ends.
 */
export function runControl(mdp: FiniteMDP, start: number, cfg: ControlConfig, rng: Rng, opts: { episodes?: number; maxTotalSteps?: number; maxEpisodeSteps?: number } = {}) {
  let st = newControl(mdp, start);
  const rewards: number[] = [];
  const lengths: number[] = [];
  const endedAt: number[] = [];
  const maxEp = opts.maxEpisodeSteps ?? 100_000;
  const episodes = opts.episodes ?? Infinity;
  const maxTotal = opts.maxTotalSteps ?? Infinity;
  let len = 0;
  while (rewards.length < episodes && st.totalSteps < maxTotal) {
    const out = controlStep(mdp, st, cfg, rng, start) as ReturnType<typeof sarsaStep> & { episodeReturn: number };
    len++;
    st = out.state;
    if (out.done || len >= maxEp) {
      rewards.push(out.episodeReturn);
      lengths.push(len);
      endedAt.push(st.totalSteps);
      len = 0;
      if (!out.done) st = { ...st, s: start, a: null, t: 0, episode: st.episode + 1, episodeReturn: 0 };
    }
  }
  return { Q: st.Q, rewards, lengths, endedAt, state: st };
}

/** Follows the greedy policy of Q from `start` (no exploration): the path learned, or null if it loops. */
export function greedyPath(mdp: FiniteMDP, Q: number[][], start: number, maxSteps = 500): number[] | null {
  const path = [start];
  let s = start;
  const seen = new Set<string>();
  while (!mdp.terminal[s]) {
    const av = avail(mdp, s);
    const best = Math.max(...av.map((a) => Q[s][a]));
    const a = av.find((x) => Q[s][x] === best)!;
    const key = `${s},${a}`;
    if (seen.has(key) || path.length > maxSteps) return null;
    seen.add(key);
    // Deterministic environments only: take the single outcome with the largest probability.
    const o = mdp.dynamics[s][a].reduce((p, x) => (x.prob > p.prob ? x : p));
    s = o.next;
    path.push(s);
  }
  return path;
}
