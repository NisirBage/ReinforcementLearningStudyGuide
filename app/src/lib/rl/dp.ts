// Dynamic programming, Sutton & Barto (April 2015 draft) Chapter 4.
import { actionValue, bellmanExpectationBackup, type FiniteMDP, type Policy } from "./mdp";

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

// ---------- Control: policy improvement, policy iteration, value iteration (§4.2–4.4) ----------


const availableActions = (mdp: FiniteMDP, s: number) => mdp.actions.map((_, a) => a).filter((a) => mdp.dynamics[s][a].length > 0);

/** q(s, a) for every state and available action (4.6); NaN where an action is not available. */
export function qFromV(mdp: FiniteMDP, v: readonly number[], gamma: number): number[][] {
  return mdp.states.map((_, s) => mdp.actions.map((_, a) => (mdp.terminal[s] || !mdp.dynamics[s][a].length ? NaN : actionValue(mdp, v, s, a, gamma))));
}

/**
 * Greedy improvement (4.9): at each nonterminal state, an action maximizing q(s, a). `ties` lists every maximizing
 * action (the arrows of Figure 4.2). When `current` is given and its action is among the maximizers it is kept; this
 * is how the app avoids the endless switching between equally good policies that the draft notes under Figure 4.3.
 */
export function greedyPolicy(mdp: FiniteMDP, v: readonly number[], gamma: number, current?: readonly number[], tol = 1e-9): { actions: number[]; ties: number[][] } {
  const q = qFromV(mdp, v, gamma);
  const ties = mdp.states.map((_, s) => {
    if (mdp.terminal[s]) return [];
    const av = availableActions(mdp, s);
    const m = Math.max(...av.map((a) => q[s][a]));
    return av.filter((a) => q[s][a] >= m - tol);
  });
  const actions = ties.map((t, s) => (t.length === 0 ? -1 : current && t.includes(current[s]) ? current[s] : t[0]));
  return { actions, ties };
}

/** The deterministic policy π(s) = actions[s] as a probability matrix. */
export const deterministic = (mdp: FiniteMDP, actions: readonly number[]): Policy => mdp.states.map((_, s) => mdp.actions.map((_, a) => (actions[s] === a ? 1 : 0)));

export interface PolicyIterationStep {
  policy: Policy; // π_k (π_0 may be stochastic, e.g. the equiprobable random policy; later ones are greedy, deterministic)
  actions: number[] | null; // π_k as one action per state, when deterministic
  v: number[]; // v_{π_k} by in-place policy evaluation, warm-started from the previous V
  sweeps: number; // evaluation sweeps used
  changed: number[]; // states whose action the following improvement changed (empty at the last step)
  ties: number[][]; // maximizing actions with respect to v
}

/**
 * Policy iteration (Figure 4.3): evaluate, improve, repeat until the policy is stable. Each evaluation starts from
 * the previous policy's values, as the draft recommends (p. 97). π_0 is `initial` (default: equiprobable random over
 * the available actions). If an evaluation does not converge, which happens with γ = 1 when a policy can loop for
 * ever (Exercise 4.4), it stops with `diverged` instead of running on.
 */
export function policyIteration(mdp: FiniteMDP, gamma: number, opts: { theta?: number; initial?: Policy; maxIterations?: number; maxSweeps?: number } = {}): { steps: PolicyIterationStep[]; stable: boolean; diverged: boolean } {
  const theta = opts.theta ?? 1e-10;
  let policy: Policy =
    opts.initial ??
    mdp.states.map((_, s) => {
      const av = mdp.terminal[s] ? [] : availableActions(mdp, s);
      return mdp.actions.map((_, a) => (av.includes(a) ? 1 / av.length : 0));
    });
  let actions: number[] | null = null;
  let v = mdp.states.map(() => 0);
  const steps: PolicyIterationStep[] = [];
  for (let k = 0; k < (opts.maxIterations ?? 100); k++) {
    const ev = iterativePolicyEvaluation(mdp, policy, gamma, { theta, v0: v, maxSweeps: opts.maxSweeps ?? 20_000 });
    const diverged = ev.deltas.at(-1)! >= theta || ev.v.some((x) => !Number.isFinite(x) || Math.abs(x) > 1e9);
    v = ev.v;
    const imp = greedyPolicy(mdp, v, gamma, actions ?? undefined);
    const changed = actions ? imp.actions.map((a, s) => (a !== actions![s] ? s : -1)).filter((s) => s >= 0) : imp.actions.map((_, s) => s).filter((s) => !mdp.terminal[s]);
    steps.push({ policy, actions, v, sweeps: ev.sweeps, changed: diverged ? [] : changed, ties: imp.ties });
    if (diverged) return { steps, stable: false, diverged: true };
    if (actions && !changed.length) return { steps, stable: true, diverged: false };
    actions = imp.actions;
    policy = deterministic(mdp, actions);
  }
  return { steps, stable: false, diverged: false };
}

/**
 * Value iteration (4.10), Figure 4.5: v_{k+1}(s) = max_a Σ p(s′, r | s, a)[r + γ v_k(s′)], in place by default,
 * until the largest change Δ < θ. Records v after each sweep when asked.
 */
export function valueIteration(mdp: FiniteMDP, gamma: number, opts: { theta?: number; maxSweeps?: number; record?: boolean; mode?: "in-place" | "two-array" } = {}) {
  const { theta = 1e-10, maxSweeps = 100_000, record = false, mode = "in-place" } = opts;
  let v = mdp.states.map(() => 0);
  const history = record ? [[...v]] : [];
  const deltas: number[] = [];
  for (let k = 0; k < maxSweeps; k++) {
    const next = mode === "in-place" ? v : [...v];
    let delta = 0;
    for (let s = 0; s < mdp.states.length; s++) {
      if (mdp.terminal[s]) continue;
      const old = v[s];
      const src = mode === "in-place" ? next : v;
      next[s] = Math.max(...availableActions(mdp, s).map((a) => actionValue(mdp, src, s, a, gamma)));
      delta = Math.max(delta, Math.abs(old - next[s]));
    }
    v = next;
    deltas.push(delta);
    if (record) history.push([...v]);
    if (delta < theta) break;
  }
  return { v, deltas, history, sweeps: deltas.length, policy: greedyPolicy(mdp, v, gamma) };
}
