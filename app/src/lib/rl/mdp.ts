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

// ---------- For the MDP Explorer and Bellman Laboratory (Milestone 3D) ----------

/** r(s, a) = Σ_{s′, r} r · p(s′, r | s, a), the expected reward (3.7). */
export const expectedReward = (mdp: FiniteMDP, s: number, a: number): number => mdp.dynamics[s][a].reduce((t, o) => t + o.prob * o.reward, 0);

/** p(s′ | s, a) = Σ_r p(s′, r | s, a), the state-transition probability (3.8). */
export const transitionProb = (mdp: FiniteMDP, s: number, a: number, next: number): number =>
  mdp.dynamics[s][a].reduce((t, o) => t + (o.next === next ? o.prob : 0), 0);

/** r(s, a, s′) = Σ_r r p(s′, r | s, a) / p(s′ | s, a) (3.9); undefined when p(s′ | s, a) = 0. */
export function expectedRewardGivenNext(mdp: FiniteMDP, s: number, a: number, next: number): number | undefined {
  const p = transitionProb(mdp, s, a, next);
  if (p === 0) return undefined;
  return mdp.dynamics[s][a].reduce((t, o) => t + (o.next === next ? o.prob * o.reward : 0), 0) / p;
}

/** One term of the Bellman backup (3.12) at state s: weight π(a|s)·p(s′,r|s,a) and its two parts. */
export interface BackupTerm {
  action: number;
  next: number;
  reward: number;
  pi: number; // π(a|s)
  p: number; // p(s′, r | s, a)
  weight: number; // π(a|s) p(s′, r | s, a)
  rewardPart: number; // weight · r
  futurePart: number; // weight · γ v(s′)
}

/** Every term of (3.12) at s, so the lab can show how the immediate reward and the discounted future add up. */
export function backupTerms(mdp: FiniteMDP, v: readonly number[], pi: Policy, s: number, gamma: number): { terms: BackupTerm[]; reward: number; future: number; total: number } {
  const terms: BackupTerm[] = [];
  if (!mdp.terminal[s])
    mdp.actions.forEach((_, a) => {
      if (!(pi[s][a] > 0)) return;
      for (const o of mdp.dynamics[s][a]) {
        const weight = pi[s][a] * o.prob;
        terms.push({ action: a, next: o.next, reward: o.reward, pi: pi[s][a], p: o.prob, weight, rewardPart: weight * o.reward, futurePart: weight * gamma * v[o.next] });
      }
    });
  const reward = terms.reduce((t, x) => t + x.rewardPart, 0);
  const future = terms.reduce((t, x) => t + x.futurePart, 0);
  return { terms, reward, future, total: reward + future };
}

/**
 * v_π exactly, by solving the |S| linear equations (4.4): v(s) − γ Σ_a π(a|s) Σ p(s′,r|s,a) v(s′) = Σ_a π(a|s) r(s,a),
 * with v = 0 at terminal states. Gaussian elimination with partial pivoting. Returns null when the system is
 * singular, which happens when γ = 1 and termination is not guaranteed under π (then v_π does not exist, p. 90).
 */
export function solveExact(mdp: FiniteMDP, pi: Policy, gamma: number): number[] | null {
  const idx = mdp.states.map((_, s) => s).filter((s) => !mdp.terminal[s]);
  const pos = new Map(idx.map((s, i) => [s, i]));
  const n = idx.length;
  const A = idx.map(() => new Array<number>(n + 1).fill(0));
  idx.forEach((s, i) => {
    A[i][i] += 1;
    mdp.actions.forEach((_, a) => {
      const w = pi[s][a];
      if (!(w > 0)) return;
      for (const o of mdp.dynamics[s][a]) {
        A[i][n] += w * o.prob * o.reward;
        const j = pos.get(o.next);
        if (j !== undefined) A[i][j] -= gamma * w * o.prob;
      }
    });
  });
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      if (f !== 0) for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  const v = mdp.states.map(() => 0);
  idx.forEach((s, i) => (v[s] = A[i][n] / A[i][i]));
  // A nearly singular system can still return huge values; treat those as "no solution".
  return v.every((x) => Number.isFinite(x) && Math.abs(x) < 1e12) ? v : null;
}
