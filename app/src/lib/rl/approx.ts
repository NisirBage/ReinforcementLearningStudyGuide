// On-policy approximation (Sutton & Barto, April 2015 draft, Chapter 9): linear gradient-descent prediction (9.3)–(9.8)
// and Figure 9.1; feature constructions (state aggregation, coarse coding, tile coding, radial basis functions); the
// asymptotic bound (9.9) computed exactly on a continuing chain; coarse coding of a square wave (Example 9.1); and the
// mountain–car task with linear Sarsa(λ) and tile coding (Example 9.2, Figures 9.8, 9.10, 9.11).
import type { Rng } from "../../domain/random";
import type { Walk } from "./traces";

// ---------- Features ----------
/** A feature function: the feature vector x(s) of state s (dense). */
export type Features = (s: number) => number[];
export const tabularFeatures = (n: number): Features => (s) => Array.from({ length: n }, (_, i) => (i === s ? 1 : 0));
/** State aggregation: states 1 … n in consecutive groups of `size`; feature g is 1 for the states of group g. */
export const aggregationFeatures = (n: number, size: number): Features => {
  const groups = Math.ceil(n / size);
  return (s) => Array.from({ length: groups }, (_, g) => (s >= 1 && s <= n && Math.floor((s - 1) / size) === g ? 1 : 0));
};
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((t, x, i) => t + x * b[i], 0);
/** (9.8): the linear approximate value w⊤x(s). */
export const linearValue = (w: readonly number[], x: readonly number[]) => dot(w, x);

// ---------- Gradient-descent prediction ----------
/** (9.3) for a linear approximator: w ← w + α[V − w⊤x(s)]x(s). */
export function gradientStep(w: number[], x: readonly number[], target: number, alpha: number) {
  const err = target - dot(w, x);
  for (let i = 0; i < w.length; i++) w[i] += alpha * err * x[i];
}
/**
 * One episode of linear gradient-descent TD(λ), Figure 9.1 / (9.5)–(9.7), on a recorded walk (terminal states have
 * value 0). On-line by default; off-line sums the increments with w fixed (Exercise 9.3).
 */
export function linearTdLambdaEpisode(w: number[], walk: Walk, feat: Features, lambda: number, alpha: number, gamma: number, mode: "online" | "offline" = "online") {
  const e = new Array(w.length).fill(0);
  const inc = mode === "offline" ? new Array(w.length).fill(0) : null;
  const T = walk.rewards.length;
  for (let t = 0; t < T; t++) {
    const x = feat(walk.states[t]);
    const v2 = t + 1 === T ? 0 : dot(w, feat(walk.states[t + 1]));
    const delta = walk.rewards[t] + gamma * v2 - dot(w, x);
    for (let i = 0; i < w.length; i++) {
      e[i] = gamma * lambda * e[i] + x[i];
      if (inc) inc[i] += alpha * delta * e[i];
      else w[i] += alpha * delta * e[i];
    }
  }
  if (inc) inc.forEach((d, i) => (w[i] += d));
}
/** The off-line forward view (9.4): each visited state moves toward its λ-return computed with the fixed w. */
export function linearLambdaReturnOffline(w: number[], walk: Walk, feat: Features, lambda: number, alpha: number, gamma: number) {
  const T = walk.rewards.length;
  const v = (k: number) => (k >= T ? 0 : dot(w, feat(walk.states[k])));
  const L = new Array(T).fill(0);
  L[T - 1] = walk.rewards[T - 1];
  for (let k = T - 2; k >= 0; k--) L[k] = walk.rewards[k] + gamma * ((1 - lambda) * v(k + 1) + lambda * L[k + 1]);
  const inc = new Array(w.length).fill(0);
  for (let t = 0; t < T; t++) {
    const x = feat(walk.states[t]);
    const err = L[t] - dot(w, x);
    for (let i = 0; i < w.length; i++) inc[i] += alpha * err * x[i];
  }
  inc.forEach((d, i) => (w[i] += d));
}

// ---------- The bound (9.9), exactly ----------
/** Solve a small dense linear system A x = b (Gaussian elimination with partial pivoting). */
export function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}
export interface Chain {
  P: number[][]; // transition matrix under π
  r: number[]; // expected reward on leaving each state
  gamma: number;
}
/** A continuing random walk on n states with reflecting ends; reward +1 for stepping right from the last state, −1 for stepping left from the first. */
export function reflectingWalk(n: number, gamma: number): Chain {
  const P = Array.from({ length: n }, () => new Array(n).fill(0));
  const r = new Array(n).fill(0);
  for (let s = 0; s < n; s++) {
    P[s][Math.max(0, s - 1)] += 0.5;
    P[s][Math.min(n - 1, s + 1)] += 0.5;
    if (s === 0) r[s] -= 0.5;
    if (s === n - 1) r[s] += 0.5;
  }
  return { P, r, gamma };
}
export function stationary(P: number[][]): number[] {
  const n = P.length;
  let d = new Array(n).fill(1 / n);
  for (let it = 0; it < 100_000; it++) {
    const e = new Array(n).fill(0);
    for (let s = 0; s < n; s++) for (let s2 = 0; s2 < n; s2++) e[s2] += d[s] * P[s][s2];
    const diff = Math.max(...e.map((x, i) => Math.abs(x - d[i])));
    d = e;
    if (diff < 1e-15) break;
  }
  return d;
}
const matVec = (M: number[][], v: number[]) => M.map((r) => dot(r, v));
export const trueValues = (c: Chain) => solve(c.P.map((row, i) => row.map((p, j) => (i === j ? 1 : 0) - c.gamma * p)), c.r);
/** RMSE (9.1) of the linear weights w under the distribution d. */
export const rmse = (c: Chain, Phi: number[][], w: number[], d: number[]) => {
  const v = trueValues(c);
  return Math.sqrt(Phi.reduce((t, x, s) => t + d[s] * (v[s] - dot(w, x)) ** 2, 0));
};
/** The minimum-RMSE weights w* (weighted least squares under d). */
export function bestWeights(c: Chain, Phi: number[][], d: number[]): number[] {
  const v = trueValues(c);
  const k = Phi[0].length;
  const A = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => Phi.reduce((t, x, s) => t + d[s] * x[i] * x[j], 0)));
  const b = Array.from({ length: k }, (_, i) => Phi.reduce((t, x, s) => t + d[s] * x[i] * v[s], 0));
  return solve(A, b);
}
/**
 * The weights w∞ to which linear TD(λ) converges with on-policy (stationary) state distribution d: the solution of
 * Φ⊤D(I − γλP)⁻¹[(I − γP)Φw − r] = 0 (Tsitsiklis and Van Roy, 1997).
 */
export function tdFixedPoint(c: Chain, Phi: number[][], d: number[], lambda: number): number[] {
  const n = c.r.length;
  const k = Phi[0].length;
  const M = c.P.map((row, i) => row.map((p, j) => (i === j ? 1 : 0) - c.gamma * lambda * p)); // I − γλP
  const cols = Array.from({ length: k }, (_, j) => Phi.map((x) => x[j]));
  const IgP = (v: number[]) => v.map((x, i) => x - c.gamma * dot(c.P[i], v)); // (I − γP)v
  const Z = cols.map((col) => solve(M, IgP(col))); // (I − γλP)⁻¹(I − γP)φ_j
  const zr = solve(M, c.r);
  const A = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => Array.from({ length: n }).reduce<number>((t, _, s) => t + d[s] * Phi[s][i] * Z[j][s], 0)));
  const b = Array.from({ length: k }, (_, i) => Array.from({ length: n }).reduce<number>((t, _, s) => t + d[s] * Phi[s][i] * zr[s], 0));
  return solve(A, b);
}
export { matVec };

// ---------- Coarse coding and tile coding in one dimension (Example 9.1, §9.3) ----------
/** Intervals of width `width` with centres spread so that about `density` of them cover [0, 1) (Figure 9.4's features). */
export function intervalFeatures(width: number, count: number): (x: number) => number[] {
  const lo = -width / 2;
  const hi = 1 + width / 2;
  const centres = Array.from({ length: count }, (_, i) => lo + ((i + 0.5) * (hi - lo)) / count);
  return (x) => centres.map((c) => (Math.abs(x - c) < width / 2 ? 1 : 0));
}
/** Example 9.1's target: a square wave, 1 on [1/3, 2/3) and 0 elsewhere on [0, 1) (our reading of the figure). */
export const squareWave = (x: number) => (x >= 1 / 3 && x < 2 / 3 ? 1 : 0);
/** Train a coarse-coded linear approximator on random examples of the square wave with α = 0.2/m; returns w after each checkpoint. */
export function coarseCodingRun(width: number, count: number, checkpoints: readonly number[], rng: Rng): { w: number[]; at: number }[] {
  const feat = intervalFeatures(width, count);
  const w = new Array(count).fill(0);
  const out: { w: number[]; at: number }[] = [];
  let k = 0;
  for (const cp of checkpoints) {
    for (; k < cp; k++) {
      const x = rng();
      const f = feat(x);
      const m = f.reduce((a, b) => a + b, 0) || 1;
      gradientStep(w, f, squareWave(x), 0.2 / m);
    }
    out.push({ w: [...w], at: cp });
  }
  return out;
}
/** RMS error of a coarse-coded approximation against the square wave on a fine grid of [0, 1). */
export function squareWaveError(width: number, count: number, w: readonly number[]): number {
  const feat = intervalFeatures(width, count);
  let se = 0;
  const N = 1000;
  for (let i = 0; i < N; i++) {
    const x = (i + 0.5) / N;
    se += (squareWave(x) - dot(w, feat(x))) ** 2;
  }
  return Math.sqrt(se / N);
}

// ---------- Tile coding in two dimensions (Figure 9.5, Example 9.2) ----------
export interface TileCoder {
  tilings: number;
  tiles: number; // tiles per dimension in each tiling (plus one extra row and column to cover offsets)
  size: number; // number of features per action
  active: (x: number, y: number) => number[]; // indices of the present features (one per tiling)
}
/**
 * Grid tilings over [0, 1] × [0, 1] (scale the state first): `tilings` tilings of `tiles` × `tiles`, each offset by a
 * random fraction of a tile width in each dimension (as in Example 9.2), with an extra row and column so no point is uncovered.
 */
export function tileCoder(tilings: number, tiles: number, rng: Rng): TileCoder {
  const offsets = Array.from({ length: tilings }, () => [rng(), rng()]);
  const per = (tiles + 1) * (tiles + 1);
  return {
    tilings,
    tiles,
    size: tilings * per,
    active: (x, y) =>
      offsets.map(([ox, oy], t) => {
        const i = Math.min(tiles, Math.floor(x * tiles + ox));
        const j = Math.min(tiles, Math.floor(y * tiles + oy));
        return t * per + i * (tiles + 1) + j;
      }),
  };
}

// ---------- Mountain car (Example 9.2) ----------
export const MC_ACTIONS = [-1, 0, 1];
export interface McState {
  p: number;
  v: number;
}
/** The draft's dynamics: v ← bound(v + 0.001A − 0.0025 cos 3p), p ← bound(p + v); at the left bound v is reset to 0; past the right bound the episode ends. */
export function mcStep(s: McState, a: number): { s: McState; done: boolean } {
  let v = Math.min(0.07, Math.max(-0.07, s.v + 0.001 * a - 0.0025 * Math.cos(3 * s.p)));
  let p = s.p + v;
  if (p >= 0.5) return { s: { p: 0.5, v }, done: true };
  if (p <= -1.2) (p = -1.2), (v = 0);
  return { s: { p, v }, done: false };
}
export const mcScale = (s: McState): [number, number] => [(s.p + 1.2) / 1.7, (s.v + 0.07) / 0.14];
export interface McAgent {
  coder: TileCoder;
  w: number[]; // one block of coder.size weights per action
  e: number[];
}
export const newMcAgent = (tilings: number, rng: Rng, tiles = 9): McAgent => {
  const coder = tileCoder(tilings, tiles, rng);
  return { coder, w: new Array(coder.size * 3).fill(0), e: new Array(coder.size * 3).fill(0) };
};
const featIdx = (ag: McAgent, s: McState, a: number) => ag.coder.active(...mcScale(s)).map((i) => a * ag.coder.size + i);
export const mcQ = (ag: McAgent, s: McState, a: number) => featIdx(ag, s, a).reduce((t, i) => t + ag.w[i], 0);
function mcPolicy(ag: McAgent, s: McState, epsilon: number, rng: Rng): number {
  if (rng() < epsilon) return Math.floor(rng() * 3);
  const q = MC_ACTIONS.map((_, a) => mcQ(ag, s, a));
  const m = Math.max(...q);
  const best = q.flatMap((x, a) => (x === m ? [a] : []));
  return best[Math.floor(rng() * best.length)];
}
export interface McConfig {
  alpha: number; // the step size per weight (the draft's α, e.g. 0.5/m)
  lambda: number;
  epsilon: number;
  traces: "replacing" | "accumulating";
  clearOthers?: boolean; // replacing traces: clear the traces of the actions not taken (Figure 9.8's option)
  maxSteps?: number;
}
/**
 * One episode of linear gradient-descent Sarsa(λ) with binary features (Figure 9.8), γ = 1, from a random start
 * (position and velocity uniform over their ranges, as in Example 9.2). Returns the number of steps.
 */
export function mcEpisode(ag: McAgent, cfg: McConfig, rng: Rng, start?: McState): number {
  ag.e.fill(0);
  let s: McState = start ?? { p: -1.2 + rng() * 1.7, v: -0.07 + rng() * 0.14 };
  let a = mcPolicy(ag, s, cfg.epsilon, rng);
  const max = cfg.maxSteps ?? 100_000;
  for (let k = 1; k <= max; k++) {
    const F = featIdx(ag, s, a);
    if (cfg.traces === "replacing") {
      if (cfg.clearOthers) for (let b = 0; b < 3; b++) if (b !== a) for (const i of featIdx(ag, s, b)) ag.e[i] = 0;
      for (const i of F) ag.e[i] = 1;
    } else for (const i of F) ag.e[i] += 1;
    const { s: s2, done } = mcStep(s, MC_ACTIONS[a]);
    let delta = -1 - F.reduce((t, i) => t + ag.w[i], 0);
    if (done) {
      for (let i = 0; i < ag.w.length; i++) if (ag.e[i]) ag.w[i] += cfg.alpha * delta * ag.e[i];
      return k;
    }
    const a2 = mcPolicy(ag, s2, cfg.epsilon, rng);
    delta += mcQ(ag, s2, a2);
    for (let i = 0; i < ag.w.length; i++)
      if (ag.e[i]) {
        ag.w[i] += cfg.alpha * delta * ag.e[i];
        ag.e[i] *= cfg.lambda;
        if (ag.e[i] < 1e-6) ag.e[i] = 0;
      }
    s = s2;
    a = a2;
  }
  return max;
}
/** The cost-to-go −max_a q̂(s, a, w) on a grid of positions × velocities (Figure 9.10). */
export function costToGo(ag: McAgent, nx = 30, ny = 30): number[][] {
  return Array.from({ length: ny }, (_, j) =>
    Array.from({ length: nx }, (_, i) => {
      const s = { p: -1.2 + ((i + 0.5) * 1.7) / nx, v: -0.07 + ((j + 0.5) * 0.14) / ny };
      return -Math.max(...MC_ACTIONS.map((_, a) => mcQ(ag, s, a)));
    }),
  );
}
/** Steps to the goal from the bottom of the valley (p = −0.5, v = 0) under the greedy policy, capped at `cap`. */
export function mcGreedySteps(ag: McAgent, cap = 1000): number {
  let s: McState = { p: -0.5, v: 0 };
  for (let k = 1; k <= cap; k++) {
    const q = MC_ACTIONS.map((_, a) => mcQ(ag, s, a));
    const r = mcStep(s, MC_ACTIONS[q.indexOf(Math.max(...q))]);
    if (r.done) return k;
    s = r.s;
  }
  return cap;
}

/**
 * One episode of linear gradient-descent Watkins's Q(λ) with binary features (Figure 9.9), γ = 1: at each step choose
 * A* = argmax_a q̂(S, a); take A* with probability 1 − ε, else a random action; if A ≠ A*, clear all traces; the TD error
 * uses max_a q̂(S′, a). Returns the number of steps.
 */
export function mcQLambdaEpisode(ag: McAgent, cfg: McConfig, rng: Rng, start?: McState): number {
  ag.e.fill(0);
  let s: McState = start ?? { p: -1.2 + rng() * 1.7, v: -0.07 + rng() * 0.14 };
  const max = cfg.maxSteps ?? 100_000;
  for (let k = 1; k <= max; k++) {
    const q = MC_ACTIONS.map((_, a) => mcQ(ag, s, a));
    const m = Math.max(...q);
    const best = q.flatMap((x, a) => (x === m ? [a] : []));
    const aStar = best[Math.floor(rng() * best.length)];
    const a = rng() < cfg.epsilon ? Math.floor(rng() * 3) : aStar;
    if (a !== aStar) ag.e.fill(0);
    const F = featIdx(ag, s, a);
    if (cfg.traces === "replacing") for (const i of F) ag.e[i] = 1;
    else for (const i of F) ag.e[i] += 1;
    const { s: s2, done } = mcStep(s, MC_ACTIONS[a]);
    let delta = -1 - q[a];
    if (done) {
      for (let i = 0; i < ag.w.length; i++) if (ag.e[i]) ag.w[i] += cfg.alpha * delta * ag.e[i];
      return k;
    }
    delta += Math.max(...MC_ACTIONS.map((_, b) => mcQ(ag, s2, b)));
    for (let i = 0; i < ag.w.length; i++)
      if (ag.e[i]) {
        ag.w[i] += cfg.alpha * delta * ag.e[i];
        ag.e[i] *= cfg.lambda;
        if (ag.e[i] < 1e-6) ag.e[i] = 0;
      }
    s = s2;
  }
  return max;
}
