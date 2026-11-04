// Dynamic programming, Sutton & Barto (April 2015 draft) Chapter 4.
import { bellmanExpectationBackup, type FiniteMDP, type Policy } from "./mdp";

export interface EvaluationResult {
  v: number[];
  sweeps: number;
  deltas: number[]; // Δ after each sweep (the max change), the quantity tested against θ
  history: number[][]; // v after each sweep when recorded, history[0] = v_0
}

/**
 * Iterative policy evaluation.
 * - mode "in-place" is the algorithm of Figure 4.1: one array, each backup immediately overwrites V(s),
 *   stop when Δ < θ.
 * - mode "two-array" computes v_{k+1} from v_k only, the update (4.5); Figure 4.2 shows these v_k.
 * maxSweeps bounds the loop; with θ = 0 it runs exactly maxSweeps sweeps (for reproducing v_k at a given k).
 */
export function iterativePolicyEvaluation(
  mdp: FiniteMDP,
  pi: Policy,
  gamma: number,
  opts: { theta?: number; maxSweeps?: number; mode?: "in-place" | "two-array"; record?: boolean; v0?: number[] } = {},
): EvaluationResult {
  const { theta = 1e-10, maxSweeps = 100_000, mode = "in-place", record = false } = opts;
  if (gamma < 0 || gamma > 1) throw new RangeError("γ must lie in [0, 1]");
  let v = opts.v0 ? [...opts.v0] : mdp.states.map(() => 0);
  v = v.map((x, s) => (mdp.terminal[s] ? 0 : x)); // the terminal state keeps value 0
  const history = record ? [[...v]] : [];
  const deltas: number[] = [];
  let sweeps = 0;
  while (sweeps < maxSweeps) {
    let delta = 0;
    const next = mode === "in-place" ? v : [...v];
    for (let s = 0; s < mdp.states.length; s++) {
      if (mdp.terminal[s]) continue;
      const old = v[s];
      next[s] = bellmanExpectationBackup(mdp, mode === "in-place" ? next : v, pi, s, gamma);
      delta = Math.max(delta, Math.abs(old - next[s]));
    }
    v = next;
    sweeps++;
    deltas.push(delta);
    if (record) history.push([...v]);
    if (delta < theta) break;
  }
  return { v, sweeps, deltas, history };
}
