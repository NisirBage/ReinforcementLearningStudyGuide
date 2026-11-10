// Batch updating (Sutton & Barto, April 2015 draft, §6.3, Examples 6.3 and 6.4): a fixed set of episodes is presented
// over and over; the increments of TD(0) (6.2) or of constant-α MC (6.1) are summed over the whole batch and applied
// once per pass, until the values stop changing. Also the two answers the draft says these converge to:
//   - batch MC: the every-visit sample average of the returns that followed each state;
//   - batch TD(0): the certainty-equivalence estimate, the exact values of the maximum-likelihood Markov reward
//     process built from the batch (transition fractions and average rewards).
import type { Step } from "./sampling";

export type Episode = readonly Step[]; // steps whose `next` may be terminal; `terminal` says which states are

/** Batch TD(0) or batch constant-α MC, from `v0`, until the largest change in a pass is below `tol`. */
export function batchUpdate(episodes: readonly Episode[], terminal: readonly boolean[], method: "td" | "mc", alpha: number, gamma: number, v0: readonly number[], opts: { tol?: number; maxPasses?: number } = {}): { V: number[]; passes: number } {
  const V = [...v0];
  const tol = opts.tol ?? 1e-10;
  for (let pass = 1; pass <= (opts.maxPasses ?? 100_000); pass++) {
    const inc = V.map(() => 0);
    for (const ep of episodes) {
      if (method === "td") for (const x of ep) inc[x.s] += alpha * (x.r + gamma * (terminal[x.next] ? 0 : V[x.next]) - V[x.s]);
      else {
        let G = 0;
        for (let t = ep.length - 1; t >= 0; t--) {
          G = gamma * G + ep[t].r;
          inc[ep[t].s] += alpha * (G - V[ep[t].s]);
        }
      }
    }
    let delta = 0;
    inc.forEach((d, s) => {
      V[s] += d;
      delta = Math.max(delta, Math.abs(d));
    });
    if (delta < tol) return { V, passes: pass };
  }
  return { V, passes: opts.maxPasses ?? 100_000 };
}

/** Every-visit sample averages of the returns (what batch constant-α MC converges to); NaN for unvisited states. */
export function sampleAverageReturns(episodes: readonly Episode[], nStates: number, gamma: number): number[] {
  const sum = new Array(nStates).fill(0);
  const n = new Array(nStates).fill(0);
  for (const ep of episodes) {
    let G = 0;
    for (let t = ep.length - 1; t >= 0; t--) {
      G = gamma * G + ep[t].r;
      sum[ep[t].s] += G;
      n[ep[t].s]++;
    }
  }
  return sum.map((x, s) => (n[s] ? x / n[s] : NaN));
}

/**
 * The certainty-equivalence estimate (what batch TD(0) converges to): build the maximum-likelihood model from the
 * observed transitions and solve its Bellman equation exactly (Gaussian elimination); NaN for unvisited states.
 */
export function certaintyEquivalence(episodes: readonly Episode[], terminal: readonly boolean[], gamma: number): number[] {
  const n = terminal.length;
  const count = new Array(n).fill(0);
  const trans = Array.from({ length: n }, () => new Array(n).fill(0));
  const rew = new Array(n).fill(0);
  for (const ep of episodes)
    for (const x of ep) {
      count[x.s]++;
      trans[x.s][x.next]++;
      rew[x.s] += x.r;
    }
  const visited = count.map((c, s) => c > 0 && !terminal[s]);
  const idx = visited.map((v, s) => (v ? s : -1)).filter((s) => s >= 0);
  const m = idx.length;
  // (I − γP) v = r over the visited nonterminal states (unvisited successors contribute 0: they cannot occur here).
  const A = idx.map((s, i) => idx.map((s2, j) => (i === j ? 1 : 0) - (gamma * trans[s][s2]) / count[s]));
  const b = idx.map((s) => rew[s] / count[s]);
  for (let col = 0; col < m; col++) {
    let piv = col;
    for (let r = col + 1; r < m; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    [A[col], A[piv]] = [A[piv], A[col]];
    [b[col], b[piv]] = [b[piv], b[col]];
    for (let r = 0; r < m; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      for (let c = col; c < m; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  const out = new Array(n).fill(NaN);
  idx.forEach((s, i) => (out[s] = b[i] / A[i][i]));
  terminal.forEach((t, s) => t && (out[s] = 0));
  return out;
}
