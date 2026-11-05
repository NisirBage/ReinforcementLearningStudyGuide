// Monte Carlo methods, Sutton & Barto (April 2015 draft) Chapter 5 and (6.1).
//
//   first-visit / every-visit prediction (§5.1, Figure 5.1): average the returns following (first) visits to s.
//     "average" is computed incrementally (2.3), V ← V + (1/N)(G − V), which equals the average of the list
//     Returns(s) in Figure 5.1; or with a constant step size α, V ← V + α(G − V), the constant-α MC of (6.1).
//   Monte Carlo ES (§5.3, Figure 5.4): exploring starts, Q(s, a) ← average of returns after first visits,
//     π(s) ← argmax_a Q(s, a) for every s in the episode.
// Each episode update returns the list of updates it made, so the laboratory can show every return and change.
import type { Rng } from "../../domain/random";
import { argmaxRandom } from "./banditLab";
import type { FiniteMDP, Policy } from "./mdp";
import { generateEpisode, type Step } from "./sampling";

/** G_t for every t of an episode, by G_t = R_{t+1} + γ G_{t+1} working backwards from the end. */
export function returnsOf(steps: readonly Step[], gamma: number): number[] {
  const g = new Array<number>(steps.length).fill(0);
  let acc = 0;
  for (let t = steps.length - 1; t >= 0; t--) g[t] = acc = steps[t].r + gamma * acc;
  return g;
}

export interface McUpdate {
  t: number;
  s: number;
  G: number;
  first: boolean; // first visit to s in this episode
  applied: boolean; // used for the update (every visit, or first visits only)
  before: number;
  after: number;
  stepSize: number;
}

export interface PredictionState {
  V: number[];
  N: number[]; // returns averaged so far per state
}

export const newPrediction = (n: number, v0 = 0): PredictionState => ({ V: new Array(n).fill(v0), N: new Array(n).fill(0) });

/** Applies one episode's returns. `alpha` undefined = sample average (1/N); a number = constant-α MC (6.1). */
export function mcUpdate(st: PredictionState, steps: readonly Step[], gamma: number, firstVisit: boolean, alpha?: number): { state: PredictionState; updates: McUpdate[] } {
  const V = [...st.V];
  const N = [...st.N];
  const G = returnsOf(steps, gamma);
  const firstAt = new Map<number, number>();
  steps.forEach((x, t) => firstAt.has(x.s) || firstAt.set(x.s, t));
  // Updates are applied in time order; with sample averages the order does not change the final averages.
  const updates = steps.map((x, t) => {
    const first = firstAt.get(x.s) === t;
    const applied = first || !firstVisit;
    const before = V[x.s];
    let stepSize = 0;
    if (applied) {
      N[x.s] += 1;
      stepSize = alpha ?? 1 / N[x.s];
      V[x.s] = before + stepSize * (G[t] - before);
    }
    return { t, s: x.s, G: G[t], first, applied, before, after: V[x.s], stepSize };
  });
  return { state: { V, N }, updates };
}

/** Runs `episodes` episodes of prediction from `start`; returns the estimates after each episode. */
export function runMcPrediction(mdp: FiniteMDP, pi: Policy, start: number, gamma: number, episodes: number, rng: Rng, opts: { firstVisit?: boolean; alpha?: number; v0?: number } = {}) {
  let st = newPrediction(mdp.states.length, opts.v0 ?? 0);
  st.V = st.V.map((x, s) => (mdp.terminal[s] ? 0 : x));
  const history: number[][] = [[...st.V]];
  for (let e = 0; e < episodes; e++) {
    const ep = generateEpisode(mdp, pi, start, rng);
    st = mcUpdate(st, ep.steps, gamma, opts.firstVisit ?? true, opts.alpha).state;
    history.push([...st.V]);
  }
  return { state: st, history };
}

// ---------- Monte Carlo ES (Figure 5.4) ----------

export interface EsState {
  Q: number[][];
  N: number[][];
  policy: number[]; // π(s), deterministic
}

const available = (mdp: FiniteMDP, s: number) => mdp.actions.map((_, a) => a).filter((a) => mdp.dynamics[s][a].length > 0);

export function newEs(mdp: FiniteMDP): EsState {
  return {
    Q: mdp.states.map(() => mdp.actions.map(() => 0)),
    N: mdp.states.map(() => mdp.actions.map(() => 0)),
    policy: mdp.states.map((_, s) => (mdp.terminal[s] ? -1 : available(mdp, s)[0])),
  };
}

/**
 * One episode of Monte Carlo ES: a random start pair (S_0, A_0) (every pair has probability > 0), then π.
 * The draft assumes every episode ends (Figure 5.4's caption). A deterministic policy on a gridworld can loop for ever,
 * so episodes are cut at `maxSteps`, and a cut-off episode's partial returns are still averaged. With a reward of −1
 * per step they are strongly negative lower bounds that push the policy away from the loop. This departs from the
 * draft's assumption, and the lab says so; `truncated` reports when it happened.
 */
export function esEpisode(mdp: FiniteMDP, st: EsState, gamma: number, rng: Rng, maxSteps = 50) {
  const starts = mdp.states.flatMap((_, s) => (mdp.terminal[s] ? [] : available(mdp, s).map((a) => [s, a] as const)));
  const [s0, a0] = starts[Math.floor(rng() * starts.length)];
  const pi: Policy = mdp.states.map((_, s) => mdp.actions.map((_, a) => (st.policy[s] === a ? 1 : 0)));
  const ep = generateEpisode(mdp, pi, s0, rng, { firstAction: a0, maxSteps });
  const Q = st.Q.map((r) => [...r]);
  const N = st.N.map((r) => [...r]);
  const G = returnsOf(ep.steps, gamma);
  const seen = new Set<string>();
  const updates: { s: number; a: number; G: number; before: number; after: number }[] = [];
  ep.steps.forEach((x, t) => {
    const key = `${x.s},${x.a}`;
    if (seen.has(key)) return; // first occurrence of (s, a) only
    seen.add(key);
    N[x.s][x.a] += 1;
    const before = Q[x.s][x.a];
    Q[x.s][x.a] = before + (G[t] - before) / N[x.s][x.a];
    updates.push({ s: x.s, a: x.a, G: G[t], before, after: Q[x.s][x.a] });
  });
  const policy = [...st.policy];
  for (const x of ep.steps) {
    const av = available(mdp, x.s);
    // π(s) ← argmax_a Q(s, a), ties broken at random among tried and untried actions alike.
    policy[x.s] = av[argmaxRandom(av.map((a) => Q[x.s][a]), rng)];
  }
  return { state: { Q, N, policy }, steps: ep.steps, truncated: ep.truncated, updates };
}
