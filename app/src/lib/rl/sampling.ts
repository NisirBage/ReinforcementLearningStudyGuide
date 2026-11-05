// Experience from a FiniteMDP: one sampled transition, and whole episodes. The sampling methods (Monte Carlo, TD)
// only ever see these samples, never the dynamics themselves.
import type { Rng } from "../../domain/random";
import type { FiniteMDP, Policy } from "./mdp";

/** Samples (s′, r) from p(·, · | s, a). */
export function sampleStep(mdp: FiniteMDP, s: number, a: number, rng: Rng): { next: number; reward: number } {
  const outs = mdp.dynamics[s][a];
  if (!outs.length) throw new Error(`action ${mdp.actions[a]} is not available in ${mdp.states[s]}`);
  let u = rng();
  for (const o of outs) {
    u -= o.prob;
    if (u < 0) return { next: o.next, reward: o.reward };
  }
  const last = outs[outs.length - 1];
  return { next: last.next, reward: last.reward };
}

/** Samples an action from π(· | s). */
export function sampleAction(pi: Policy, s: number, rng: Rng): number {
  let u = rng();
  const row = pi[s];
  for (let a = 0; a < row.length; a++) {
    u -= row[a];
    if (u < 0) return a;
  }
  let last = row.length - 1;
  while (last > 0 && !(row[last] > 0)) last--;
  return last;
}

export interface Step {
  t: number;
  s: number; // S_t
  a: number; // A_t
  r: number; // R_{t+1}
  next: number; // S_{t+1}
}

/**
 * One episode S_0, A_0, R_1, S_1, … under π from `start` (optionally with a fixed first action, for exploring
 * starts), until a terminal state or `maxSteps` (then `truncated` is true: the return is not a full sample).
 */
export function generateEpisode(mdp: FiniteMDP, pi: Policy, start: number, rng: Rng, opts: { firstAction?: number; maxSteps?: number } = {}): { steps: Step[]; truncated: boolean } {
  const steps: Step[] = [];
  let s = start;
  const max = opts.maxSteps ?? 10_000;
  while (!mdp.terminal[s]) {
    if (steps.length >= max) return { steps, truncated: true };
    const a = steps.length === 0 && opts.firstAction !== undefined ? opts.firstAction : sampleAction(pi, s, rng);
    const { next, reward } = sampleStep(mdp, s, a, rng);
    steps.push({ t: steps.length, s, a, r: reward, next });
    s = next;
  }
  return { steps, truncated: false };
}
