// Finite MDPs in the four-argument form of the April 2015 draft, p(s′, r | s, a) (eq. 3.6), and Bellman backups.

export interface Transition {
  next: number; // state index; terminal states are flagged in `terminal`
  reward: number;
  prob: number;
}

export interface FiniteMDP {
  states: string[]; // labels, S+ (terminal states included)
  terminal: boolean[];
  actions: string[]; // A(s) = all actions for every nonterminal state in these examples
  /** dynamics[s][a] lists the (s′, r) outcomes with probability p(s′, r | s, a); empty for terminal states. */
  dynamics: Transition[][][];
}

/** A stochastic policy π(a|s) as a matrix [state][action]. */
export type Policy = number[][];

export function equiprobablePolicy(mdp: FiniteMDP): Policy {
  return mdp.states.map((_, s) => mdp.actions.map(() => (mdp.terminal[s] ? 0 : 1 / mdp.actions.length)));
}

/** Throws if some p(·,·|s,a) does not sum to 1 or a policy row does not sum to 1. */
export function checkMDP(mdp: FiniteMDP, pi?: Policy): void {
  mdp.dynamics.forEach((row, s) => {
    if (mdp.terminal[s]) return;
    row.forEach((outs, a) => {
      const total = outs.reduce((t, o) => t + o.prob, 0);
      if (Math.abs(total - 1) > 1e-9) throw new Error(`p(·|${mdp.states[s]},${mdp.actions[a]}) sums to ${total}`);
    });
  });
  pi?.forEach((row, s) => {
    if (mdp.terminal[s]) return;
    const total = row.reduce((t, x) => t + x, 0);
    if (Math.abs(total - 1) > 1e-9) throw new Error(`π(·|${mdp.states[s]}) sums to ${total}`);
  });
}

/** q(s,a) = Σ_{s′,r} p(s′,r|s,a)[r + γ v(s′)], the one-step lookahead inside (3.12), (4.5) and (4.6). */
export function actionValue(mdp: FiniteMDP, v: readonly number[], s: number, a: number, gamma: number): number {
  return mdp.dynamics[s][a].reduce((t, o) => t + o.prob * (o.reward + gamma * v[o.next]), 0);
}

/** Right-hand side of the Bellman equation for v_π (3.12) at state s: Σ_a π(a|s) q(s,a). Terminal states are 0. */
export function bellmanExpectationBackup(mdp: FiniteMDP, v: readonly number[], pi: Policy, s: number, gamma: number): number {
  if (mdp.terminal[s]) return 0;
  return mdp.actions.reduce((t, _, a) => t + pi[s][a] * actionValue(mdp, v, s, a, gamma), 0);
}

/** Largest violation of the Bellman equation (3.12) by v: max_s |v(s) − backup(s)|. Zero exactly at v_π. */
export function bellmanResidual(mdp: FiniteMDP, v: readonly number[], pi: Policy, gamma: number): number {
  return Math.max(...mdp.states.map((_, s) => Math.abs(v[s] - bellmanExpectationBackup(mdp, v, pi, s, gamma))));
}

/** Actions achieving max_a q(s,a) at each nonterminal state (ties within tol kept), as drawn in Figure 4.2. */
export function greedyActions(mdp: FiniteMDP, v: readonly number[], gamma: number, tol = 1e-9): number[][] {
  return mdp.states.map((_, s) => {
    if (mdp.terminal[s]) return [];
    const qs = mdp.actions.map((_, a) => actionValue(mdp, v, s, a, gamma));
    const m = Math.max(...qs);
    return qs.flatMap((q, a) => (q >= m - tol ? [a] : []));
  });
}
