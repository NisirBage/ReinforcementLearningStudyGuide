// Eligibility traces (Sutton & Barto, April 2015 draft, Chapter 7).
//
// Prediction methods work on recorded walks: states S_0 … S_T (S_T terminal) and rewards R_1 … R_T. Every method
// takes the value table V and changes it in place, either on-line (as the episode goes) or off-line (the sum of the
// episode's increments applied at its end, (7.4)).
//
// A note on V_t. The draft writes the n-step and λ-return targets with V_t, the values at time t (7.2), (7.7). On-line,
// we read V_t as the values after the increments of steps 0 … t − 1; for an n-step method this is exactly what a causal
// implementation has when the increment for step t becomes computable at time t + n. The forward-view (λ-return)
// methods are computed after the episode in the order t = 0, 1, …, which gives the same values.
import type { FiniteMDP } from "./mdp";
import type { Rng } from "../../domain/random";

// ---------- The random walks of Examples 6.2 and 7.1 ----------
/** A walk of `n` nonterminal states (1 … n) between two terminals (0 and n + 1); `left` and `right` are the exit rewards. */
export function randomWalkN(n = 19, left = -1, right = 1): FiniteMDP {
  const states = Array.from({ length: n + 2 }, (_, s) => (s === 0 ? "left end" : s === n + 1 ? "right end" : String(s)));
  const terminal = states.map((_, s) => s === 0 || s === n + 1);
  const dynamics = states.map((_, s) =>
    terminal[s] ? [[]] : [[{ next: s - 1, reward: s - 1 === 0 ? left : 0, prob: 0.5 }, { next: s + 1, reward: s + 1 === n + 1 ? right : 0, prob: 0.5 }]],
  );
  return { states, terminal, actions: ["walk"], dynamics };
}
/** True values of the walk with γ = 1: from state k, left + (right − left)·k/(n + 1). */
export const randomWalkTrue = (n = 19, left = -1, right = 1) => Array.from({ length: n + 2 }, (_, s) => (s === 0 || s === n + 1 ? 0 : left + ((right - left) * s) / (n + 1)));

export interface Walk {
  states: number[]; // S_0 … S_T
  rewards: number[]; // R_1 … R_T (rewards[t] = R_{t+1})
}
export function sampleWalk(n: number, rng: Rng, left = -1, right = 1): Walk {
  let s = Math.ceil(n / 2);
  const states = [s];
  const rewards: number[] = [];
  while (s !== 0 && s !== n + 1) {
    s += rng() < 0.5 ? -1 : 1;
    states.push(s);
    rewards.push(s === 0 ? left : s === n + 1 ? right : 0);
  }
  return { states, rewards };
}

// ---------- n-step returns, (7.1)–(7.5) ----------
/** G_t^{t+n}(V(S_{t+n})): n rewards, then the discounted estimate; the complete return if the horizon reaches T. */
export function nStepReturn(w: Walk, t: number, n: number, V: readonly number[], gamma: number): number {
  const T = w.rewards.length;
  const h = Math.min(t + n, T);
  let g = 0;
  for (let k = h - 1; k >= t; k--) g = w.rewards[k] + gamma * g;
  if (t + n < T) g += gamma ** n * V[w.states[t + n]];
  return g;
}
export type Mode = "online" | "offline";
/** One episode of n-step TD (7.2), on-line (7.3) or off-line (7.4). */
export function nStepEpisode(V: number[], w: Walk, n: number, alpha: number, gamma: number, mode: Mode) {
  const T = w.rewards.length;
  if (mode === "online") {
    for (let t = 0; t < T; t++) V[w.states[t]] += alpha * (nStepReturn(w, t, n, V, gamma) - V[w.states[t]]);
    return;
  }
  const inc = V.map(() => 0);
  for (let t = 0; t < T; t++) inc[w.states[t]] += alpha * (nStepReturn(w, t, n, V, gamma) - V[w.states[t]]);
  inc.forEach((d, s) => (V[s] += d));
}

// ---------- The λ-return, (7.6)–(7.7) ----------
/** L_t = (1 − λ) Σ_{n=1}^{T−t−1} λ^{n−1} G_t^{t+n} + λ^{T−t−1} G_t, by the recursion L_t = R_{t+1} + γ[(1 − λ)V(S_{t+1}) + λ L_{t+1}]. */
export function lambdaReturn(w: Walk, t: number, lambda: number, V: readonly number[], gamma: number): number {
  const T = w.rewards.length;
  let L = w.rewards[T - 1];
  for (let k = T - 2; k >= t; k--) L = w.rewards[k] + gamma * ((1 - lambda) * V[w.states[k + 1]] + lambda * L);
  return L;
}
/** One episode of the λ-return algorithm (forward view), on-line or off-line. */
export function lambdaReturnEpisode(V: number[], w: Walk, lambda: number, alpha: number, gamma: number, mode: Mode) {
  const T = w.rewards.length;
  if (mode === "online") {
    for (let t = 0; t < T; t++) V[w.states[t]] += alpha * (lambdaReturn(w, t, lambda, V, gamma) - V[w.states[t]]);
    return;
  }
  // Off-line: V is fixed through the episode, so all λ-returns come from one backward pass.
  const L = new Array(T).fill(0);
  L[T - 1] = w.rewards[T - 1];
  for (let k = T - 2; k >= 0; k--) L[k] = w.rewards[k] + gamma * ((1 - lambda) * V[w.states[k + 1]] + lambda * L[k + 1]);
  const inc = V.map(() => 0);
  for (let t = 0; t < T; t++) inc[w.states[t]] += alpha * (L[t] - V[w.states[t]]);
  inc.forEach((d, s) => (V[s] += d));
}

// ---------- TD(λ), the backward view, (7.8)–(7.13), Figure 7.7 ----------
export type TraceKind = "accumulating" | "dutch" | "replacing";
/** The visited state's trace after decay: (7.9), (7.13) or (7.12). `decayed` is γλE_{t−1}(S_t). */
export function bumpTrace(decayed: number, kind: TraceKind, alpha: number): number {
  return kind === "accumulating" ? decayed + 1 : kind === "dutch" ? (1 - alpha) * decayed + 1 : 1;
}
export interface TdLambdaOptions {
  mode?: Mode;
  minTrace?: number; // Exercise 7.6: only states whose trace exceeds this are updated (and kept)
}
/**
 * One episode of TD(λ). Returns how many value updates were made (for Exercise 7.6). On-line updates follow Figure 7.7;
 * off-line increments are summed with V fixed and applied at the end.
 */
export function tdLambdaEpisode(V: number[], w: Walk, lambda: number, alpha: number, gamma: number, kind: TraceKind, opts: TdLambdaOptions = {}, terminal?: readonly boolean[]): number {
  const mode = opts.mode ?? "online";
  const min = opts.minTrace ?? 0;
  const E = new Map<number, number>(); // nonzero traces only
  const inc = mode === "offline" ? V.map(() => 0) : null;
  const val = (s: number) => (terminal?.[s] ? 0 : V[s]);
  let updates = 0;
  const T = w.rewards.length;
  for (let t = 0; t < T; t++) {
    const s = w.states[t];
    const s2 = w.states[t + 1];
    const delta = w.rewards[t] + gamma * (t + 1 === T ? 0 : val(s2)) - val(s);
    E.set(s, bumpTrace(E.get(s) ?? 0, kind, alpha));
    for (const [x, e] of E) {
      if (inc) inc[x] += alpha * delta * e;
      else V[x] += alpha * delta * e;
      updates++;
      const d = gamma * lambda * e;
      if (d > min) E.set(x, d);
      else E.delete(x);
    }
  }
  if (inc) inc.forEach((d, x) => (V[x] += d));
  return updates;
}

/** One episode of true on-line TD(λ), exactly as Figure 7.10 (dutch traces). */
export function trueOnlineTdLambdaEpisode(V: number[], w: Walk, lambda: number, alpha: number, gamma: number) {
  const E = V.map(() => 0);
  let vOld = 0;
  const T = w.rewards.length;
  for (let t = 0; t < T; t++) {
    const s = w.states[t];
    const s2 = w.states[t + 1];
    const v2 = t + 1 === T ? 0 : V[s2];
    const D = V[s] - vOld;
    vOld = v2;
    const delta = w.rewards[t] + gamma * v2 - V[s];
    E[s] = (1 - alpha) * E[s] + 1;
    for (let x = 0; x < V.length; x++) {
      if (E[x] === 0) continue;
      V[x] += alpha * (delta + D) * E[x];
      E[x] *= gamma * lambda;
    }
    V[s] -= alpha * D;
  }
}

/** Constant-α MC (6.1), every-visit: off-line (increments summed with V fixed) or applied in time order at the episode's end. */
export function constantAlphaMcEpisode(V: number[], w: Walk, alpha: number, gamma: number, mode: "offline" | "sequential") {
  const T = w.rewards.length;
  const G = new Array(T).fill(0);
  let g = 0;
  for (let t = T - 1; t >= 0; t--) G[t] = g = w.rewards[t] + gamma * g;
  if (mode === "sequential") {
    for (let t = 0; t < T; t++) V[w.states[t]] += alpha * (G[t] - V[w.states[t]]);
    return;
  }
  const inc = V.map(() => 0);
  for (let t = 0; t < T; t++) inc[w.states[t]] += alpha * (G[t] - V[w.states[t]]);
  inc.forEach((d, s) => (V[s] += d));
}

/** Exercise 7.4: the half-life τ of the weighting λ^n, λ^τ = 1/2. */
export const halfLife = (lambda: number) => Math.log(0.5) / Math.log(lambda);

// ---------- The random-walk experiments of Figures 7.2 and 7.6 ----------
export type PredictionMethod =
  | { kind: "n-step"; n: number; mode: Mode }
  | { kind: "lambda-return"; lambda: number; mode: Mode }
  | { kind: "td-lambda"; lambda: number; trace: TraceKind; mode: Mode }
  | { kind: "true-online"; lambda: number };
export function runEpisode(V: number[], w: Walk, m: PredictionMethod, alpha: number, gamma = 1) {
  if (m.kind === "n-step") nStepEpisode(V, w, m.n, alpha, gamma, m.mode);
  else if (m.kind === "lambda-return") lambdaReturnEpisode(V, w, m.lambda, alpha, gamma, m.mode);
  else if (m.kind === "td-lambda") tdLambdaEpisode(V, w, m.lambda, alpha, gamma, m.trace, { mode: m.mode });
  else trueOnlineTdLambdaEpisode(V, w, m.lambda, alpha, gamma);
}
/**
 * Example 7.1's measure: the RMS error over the n states at the end of each of the first `episodes` episodes,
 * averaged over those episodes and over the runs (values start at 0; the same walks for every method). Values that
 * blow up are capped, as the draft's curves leave the plot.
 */
export function walkExperiment(m: PredictionMethod, alpha: number, walks: readonly (readonly Walk[])[], n = 19): number {
  const truth = randomWalkTrue(n);
  let total = 0;
  for (const run of walks) {
    const V = new Array(n + 2).fill(0);
    for (const w of run) {
      runEpisode(V, w, m, alpha);
      let se = 0;
      for (let s = 1; s <= n; s++) se += (V[s] - truth[s]) ** 2;
      const e = Math.sqrt(se / n);
      total += Number.isFinite(e) ? Math.min(e, 1e3) : 1e3;
    }
  }
  return total / (walks.length * walks[0].length);
}
/** `runs` sets of `episodes` walks, shared by every method (as in Example 7.1). */
export const walkSets = (runs: number, episodes: number, rng: Rng, n = 19) => Array.from({ length: runs }, () => Array.from({ length: episodes }, () => sampleWalk(n, rng)));

// ---------- Control: Sarsa(λ) and Watkins's Q(λ), Figures 7.12 and 7.15 ----------
export interface TraceControlStep {
  s: number;
  a: number;
  r: number;
  s2: number;
  a2: number | null; // the next action (null at the end of the episode)
  explored: boolean; // Q(λ): the next action was not greedy, so the traces were cut
}
/**
 * One update of Sarsa(λ) or Watkins's Q(λ) for the transition (S, A, R, S′) with next action A′ already chosen.
 * Q of a terminal state is 0. Ties: as in Figure 7.15, if A′ ties for the maximum then A* = A′.
 */
export function traceControlUpdate(Q: number[][], E: number[][], mdp: FiniteMDP, method: "sarsa" | "watkins", kind: TraceKind, step: { s: number; a: number; r: number; s2: number; a2: number | null }, alpha: number, gamma: number, lambda: number): { delta: number; cut: boolean } {
  const { s, a, r, s2, a2 } = step;
  const term = mdp.terminal[s2];
  let target = 0;
  let cut = false;
  if (!term && a2 !== null) {
    if (method === "sarsa") target = Q[s2][a2];
    else {
      const best = Math.max(...Q[s2]);
      target = best;
      cut = Q[s2][a2] !== best; // A′ is not greedy (if it ties for the max, A* = A′)
    }
  }
  const delta = r + gamma * target - Q[s][a];
  E[s][a] = bumpTrace(E[s][a], kind, alpha);
  for (let x = 0; x < Q.length; x++)
    for (let y = 0; y < Q[x].length; y++) {
      if (E[x][y] === 0) continue;
      Q[x][y] += alpha * delta * E[x][y];
      E[x][y] = cut ? 0 : gamma * lambda * E[x][y];
    }
  return { delta, cut };
}

/**
 * Example 7.2 (Figure 7.13): replay one fixed episode (a path of state–action pairs ending where the only nonzero
 * reward, `reward`, is received) from Q = 0, with one-step Sarsa (λ = 0) or Sarsa(λ). Returns Q afterwards.
 * With `exploratoryAt` = j, the action of the j-th pair is treated as exploratory (nongreedy) under Watkins's Q(λ):
 * the traces are cut as that action is chosen, so only pairs from j on share the reward. (With Q = 0 every action
 * ties, so no action is nongreedy by the values themselves; the lab declares one to show the effect.)
 */
export function replayPath(mdp: FiniteMDP, path: readonly { s: number; a: number }[], finalState: number, reward: number, lambda: number, alpha: number, gamma = 1, kind: TraceKind = "accumulating", exploratoryAt?: number): number[][] {
  const Q = mdp.states.map(() => mdp.actions.map(() => 0));
  const E = mdp.states.map(() => mdp.actions.map(() => 0));
  for (let i = 0; i < path.length; i++) {
    const last = i === path.length - 1;
    const s2 = last ? finalState : path[i + 1].s;
    traceControlUpdate(Q, E, mdp, "sarsa", kind, { s: path[i].s, a: path[i].a, r: last ? reward : 0, s2, a2: last ? null : path[i + 1].a }, alpha, gamma, lambda);
    if (exploratoryAt !== undefined && i + 1 === exploratoryAt) for (const row of E) row.fill(0); // Watkins's Q(λ): A′ is nongreedy, so cut
  }
  return Q;
}

/** An open gridworld for Example 7.2: four moves (up, down, right, left; walls stop the agent), reward 1 on entering the goal, which ends the episode. */
export function openGrid(rows: number, cols: number, goal: [number, number]): FiniteMDP & { rows: number; cols: number; goal: number } {
  const id = (r: number, c: number) => r * cols + c;
  const g = id(goal[0], goal[1]);
  const moves: [number, number][] = [[-1, 0], [1, 0], [0, 1], [0, -1]];
  const states = Array.from({ length: rows * cols }, (_, s) => `(${Math.floor(s / cols)},${s % cols})`);
  const terminal = states.map((_, s) => s === g);
  const dynamics = states.map((_, s) =>
    s === g
      ? moves.map(() => [])
      : moves.map(([dr, dc]) => {
          const r = Math.min(rows - 1, Math.max(0, Math.floor(s / cols) + dr));
          const c = Math.min(cols - 1, Math.max(0, (s % cols) + dc));
          return [{ next: id(r, c), reward: id(r, c) === g ? 1 : 0, prob: 1 }];
        }),
  );
  return { states, terminal, actions: ["up", "down", "right", "left"], dynamics, rows, cols, goal: g };
}
/** Follow a list of actions from `start` in a deterministic gridworld; returns the visited pairs and the final state. */
export function pathFromActions(mdp: FiniteMDP, start: number, actions: readonly number[]): { path: { s: number; a: number }[]; final: number } {
  const path: { s: number; a: number }[] = [];
  let s = start;
  for (const a of actions) {
    path.push({ s, a });
    s = mdp.dynamics[s][a][0].next;
    if (mdp.terminal[s]) break;
  }
  return { path, final: s };
}
/** Example 7.2's path: a wandering walk to the goal of a 7 × 10 grid that never repeats a state–action pair. */
export const EXAMPLE_7_2 = { rows: 7, cols: 10, goal: [2, 7] as [number, number], start: 6 * 10 + 1, actions: [0, 0, 2, 2, 0, 0, 3, 0, 0, 2, 2, 2, 1, 2, 2, 0, 2, 1, 1, 3] };
