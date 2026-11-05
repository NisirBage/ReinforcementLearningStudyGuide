// Bandit agents and the n-armed testbed for the Bandit Laboratory (Sutton & Barto, April 2015 draft, Chapter 2).
//
//   ε-greedy / greedy (§2.2), with sample-average (2.3) or constant-α (2.5) estimates and any initial value Q_1
//   (so "optimistic initial values", §2.5, is ε = 0 with Q_1 = +5); UCB (2.8, §2.6); gradient bandit (2.9)–(2.10,
//   §2.7) with or without the reward baseline R̄_t.
//
// One agent step is `agentStep`, which returns every intermediate value (estimates before and after, the ε coin, the
// UCB scores, π_t, R̄_t, the step size) so the lab can show the arithmetic. The fast experiment runner calls the same
// selection and update functions; a test checks the two agree step for step on the same seed.
//
// Notes on the draft:
//   - ties are broken at random (the draft does so for Figure 2.1);
//   - R̄_t is "the average of all the rewards up through and including time t" (p. 43), so it includes R_t;
//   - the printed numerator of (2.9) has a stray parenthesis, e^{H_t(a))}; read as e^{H_t(a)} (flagged in content).
import { makeRng, type Rng } from "../../domain/random";

export type StepSize = { kind: "sample-average" } | { kind: "constant"; alpha: number };
export type Method =
  | { kind: "epsilon-greedy"; epsilon: number; q1: number; step: StepSize } // ε = 0 is greedy
  | { kind: "ucb"; c: number; q1: number; step: StepSize }
  | { kind: "gradient"; alpha: number; baseline: boolean };

export interface Testbed {
  arms: number; // n
  meanOfMeans: number; // q(a) ~ N(meanOfMeans, sdOfMeans²); the draft's testbed uses 0 (Figure 2.4: 4)
  sdOfMeans: number;
  rewardSd: number; // R_t ~ N(q(A_t), rewardSd²); the draft uses 1
}
export const TESTBED_10: Testbed = { arms: 10, meanOfMeans: 0, sdOfMeans: 1, rewardSd: 1 };

/** Standard normal sample (Box–Muller) from a uniform generator. */
export function gaussian(rng: Rng): number {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** The true values q(a) of one bandit problem. */
export const makeProblem = (tb: Testbed, rng: Rng): number[] => Array.from({ length: tb.arms }, () => tb.meanOfMeans + tb.sdOfMeans * gaussian(rng));

/** One of the maximal entries, ties broken uniformly at random. */
export function argmaxRandom(xs: ArrayLike<number>, rng: Rng): number {
  let best = -Infinity;
  let count = 0;
  let pick = 0;
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] > best) {
      best = xs[i];
      count = 1;
      pick = i;
    } else if (xs[i] === best) {
      count++;
      if (rng() * count < 1) pick = i; // reservoir sampling: uniform among ties
    }
  }
  return pick;
}

/** π_t(a) of (2.9), computed with the maximum subtracted (the same probabilities, without overflow). */
export function softmax(h: ArrayLike<number>): number[] {
  let m = -Infinity;
  for (let i = 0; i < h.length; i++) m = Math.max(m, h[i]);
  const e = Array.from(h, (x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

/** Samples an index from probabilities p. */
export function sample(p: ArrayLike<number>, rng: Rng): number {
  let u = rng();
  for (let i = 0; i < p.length; i++) {
    u -= p[i];
    if (u < 0) return i;
  }
  return p.length - 1;
}

export interface AgentState {
  method: Method;
  t: number; // steps taken so far (the next step is t + 1)
  values: number[]; // Q_t(a), or H_t(a) for the gradient bandit
  counts: number[]; // N_t(a)
  baseline: number; // R̄ (gradient bandit), the mean of all rewards so far
}

export const newAgent = (method: Method, arms: number): AgentState => ({
  method,
  t: 0,
  values: Array.from({ length: arms }, () => (method.kind === "gradient" ? 0 : method.q1)),
  counts: new Array(arms).fill(0),
  baseline: 0,
});

/** Every quantity involved in one step, for the step inspector. */
export interface StepDetail {
  t: number;
  before: number[]; // Q_t or H_t
  counts: number[]; // N_t before the step
  explored?: boolean; // ε-greedy: the ε branch was taken
  scores?: number[]; // UCB scores (Infinity for untried actions)
  probs?: number[]; // gradient: π_t
  action: number; // A_t
  reward: number; // R_t
  stepSize?: number; // the α or 1/N(a) used for Q, or α for H
  baseline?: number; // gradient: R̄_t (including R_t) or 0 without baseline
  after: number[]; // Q_{t+1} or H_{t+1}
}

function select(s: AgentState, rng: Rng): Pick<StepDetail, "explored" | "scores" | "probs" | "action"> {
  const m = s.method;
  if (m.kind === "epsilon-greedy") {
    const explored = m.epsilon > 0 && rng() < m.epsilon;
    return { explored, action: explored ? Math.floor(rng() * s.values.length) : argmaxRandom(s.values, rng) };
  }
  if (m.kind === "ucb") {
    const t = s.t + 1;
    const scores = s.values.map((q, a) => (s.counts[a] === 0 ? Infinity : q + m.c * Math.sqrt(Math.log(t) / s.counts[a])));
    return { scores, action: argmaxRandom(scores, rng) };
  }
  const probs = softmax(s.values);
  return { probs, action: sample(probs, rng) };
}

function update(s: AgentState, a: number, r: number, probs?: number[]): { state: AgentState; stepSize: number; baseline?: number } {
  const m = s.method;
  const counts = s.counts.slice();
  counts[a] += 1;
  const t = s.t + 1;
  if (m.kind === "gradient") {
    // R̄_t: the average of all rewards up through and including time t (draft, p. 43).
    const mean = s.baseline + (r - s.baseline) / t;
    const b = m.baseline ? mean : 0;
    const values = s.values.map((h, i) => (i === a ? h + m.alpha * (r - b) * (1 - probs![i]) : h - m.alpha * (r - b) * probs![i])); // (2.10)
    return { state: { ...s, t, counts, values, baseline: mean }, stepSize: m.alpha, baseline: b };
  }
  const alpha = m.step.kind === "sample-average" ? 1 / counts[a] : m.step.alpha;
  const values = s.values.slice();
  values[a] = values[a] + alpha * (r - values[a]); // (2.3) or (2.5)
  return { state: { ...s, t, counts, values }, stepSize: alpha };
}

/** One full step: select A_t, draw R_t ~ N(q(A_t), σ²), update. Returns the new state and every intermediate value. */
export function agentStep(s: AgentState, q: readonly number[], rewardSd: number, rng: Rng): { state: AgentState; detail: StepDetail } {
  const sel = select(s, rng);
  const reward = q[sel.action] + rewardSd * gaussian(rng);
  const u = update(s, sel.action, reward, sel.probs);
  return {
    state: u.state,
    detail: { t: s.t + 1, before: s.values, counts: s.counts, ...sel, reward, stepSize: u.stepSize, baseline: u.baseline, after: u.state.values },
  };
}

/** Seeds for run r of an experiment: the problem and the agent's randomness, so every method faces the same problems. */
const problemRng = (seed: number, run: number) => makeRng((seed * 1_000_003 + run * 7919) >>> 0);
const agentRng = (seed: number, run: number, m: number) => makeRng((seed * 999_983 + run * 104_729 + m * 15_485_863 + 1) >>> 0);

/** One recorded run (for the step inspector): every step of one method on one problem. */
export function recordRun(tb: Testbed, method: Method, steps: number, seed: number, run = 0, methodIndex = 0) {
  const q = makeProblem(tb, problemRng(seed, run));
  const rng = agentRng(seed, run, methodIndex);
  let s = newAgent(method, tb.arms);
  const best = q.indexOf(Math.max(...q));
  const details: StepDetail[] = [];
  for (let i = 0; i < steps; i++) {
    const out = agentStep(s, q, tb.rewardSd, rng);
    s = out.state;
    details.push(out.detail);
  }
  return { q, best, details, final: s };
}

export interface Curves {
  avgReward: Float64Array; // mean R_t over runs, per step
  pctOptimal: Float64Array; // share of runs choosing an optimal action, per step
}

/**
 * Runs `runs` independent problems for each method and averages, as in Figures 2.1–2.4. Runs are processed in
 * blocks [from, to) so the UI can stay responsive; pass the same `acc` to continue. Method i on run r always
 * uses the same random streams, so results do not depend on the block size.
 */
export function runBlock(tb: Testbed, methods: Method[], steps: number, seed: number, from: number, to: number, acc: Curves[] = methods.map(() => ({ avgReward: new Float64Array(steps), pctOptimal: new Float64Array(steps) }))): Curves[] {
  const n = tb.arms;
  const values = new Float64Array(n);
  const counts = new Float64Array(n);
  const probs = new Float64Array(n);
  const scores = new Float64Array(n);
  for (let r = from; r < to; r++) {
    const q = makeProblem(tb, problemRng(seed, r));
    let best = -Infinity;
    for (const x of q) best = Math.max(best, x);
    methods.forEach((m, mi) => {
      // The same arithmetic as select() and update(), in place (checked step for step by lab.bandit.step-matches-fast).
      const rng = agentRng(seed, r, mi);
      values.fill(m.kind === "gradient" ? 0 : m.q1);
      counts.fill(0);
      let mean = 0;
      const c = acc[mi];
      for (let i = 0; i < steps; i++) {
        const t = i + 1;
        let a: number;
        if (m.kind === "epsilon-greedy") {
          const explored = m.epsilon > 0 && rng() < m.epsilon;
          a = explored ? Math.floor(rng() * n) : argmaxRandom(values, rng);
        } else if (m.kind === "ucb") {
          for (let k = 0; k < n; k++) scores[k] = counts[k] === 0 ? Infinity : values[k] + m.c * Math.sqrt(Math.log(t) / counts[k]);
          a = argmaxRandom(scores, rng);
        } else {
          let mx = -Infinity;
          for (let k = 0; k < n; k++) mx = Math.max(mx, values[k]);
          let sum = 0;
          for (let k = 0; k < n; k++) sum += probs[k] = Math.exp(values[k] - mx);
          for (let k = 0; k < n; k++) probs[k] /= sum;
          a = sample(probs, rng);
        }
        const reward = q[a] + tb.rewardSd * gaussian(rng);
        counts[a] += 1;
        if (m.kind === "gradient") {
          mean = mean + (reward - mean) / t;
          const d = m.alpha * (reward - (m.baseline ? mean : 0));
          for (let k = 0; k < n; k++) values[k] = k === a ? values[k] + d * (1 - probs[k]) : values[k] - d * probs[k];
        } else {
          const alpha = m.step.kind === "sample-average" ? 1 / counts[a] : m.step.alpha;
          values[a] = values[a] + alpha * (reward - values[a]);
        }
        c.avgReward[i] += reward;
        if (q[a] === best) c.pctOptimal[i] += 1;
      }
    });
  }
  return acc;
}

/** Divides accumulated sums by the number of runs. */
export const finishCurves = (acc: Curves[], runs: number): Curves[] => acc.map((c) => ({ avgReward: c.avgReward.map((x) => x / runs), pctOptimal: c.pctOptimal.map((x) => x / runs) }));

/** All runs at once (tests and checks). */
export const runExperiment = (tb: Testbed, methods: Method[], runs: number, steps: number, seed: number): Curves[] => finishCurves(runBlock(tb, methods, steps, seed, 0, runs), runs);

/** Mean of a curve over steps [from, to). */
export const meanOver = (xs: ArrayLike<number>, from: number, to: number): number => {
  let s = 0;
  for (let i = from; i < to; i++) s += xs[i];
  return s / (to - from);
};

/** E[max of n standard normals], by numerical integration: the best average reward possible on the testbed. */
export function expectedMaxNormal(n: number): number {
  // E[M] = ∫ x · n φ(x) Φ(x)^{n−1} dx, Simpson's rule on [−8, 8].
  const phi = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const Phi = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));
  const f = (x: number) => x * n * phi(x) * Phi(x) ** (n - 1);
  const N = 4000;
  const a = -8;
  const h = 16 / N;
  let s = f(a) + f(a + N * h);
  for (let i = 1; i < N; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}

/** Error function (Abramowitz–Stegun 7.1.26 is too coarse here; this uses a series/continued-fraction pair). */
export function erf(x: number): number {
  const sign = Math.sign(x);
  const z = Math.abs(x);
  if (z < 3) {
    // Maclaurin series: erf z = 2/√π Σ (−1)^k z^{2k+1} / (k! (2k+1))
    let term = z;
    let sum = z;
    for (let k = 1; k < 80; k++) {
      term *= (-z * z) / k;
      sum += term / (2 * k + 1);
    }
    return (sign * 2 * sum) / Math.sqrt(Math.PI);
  }
  // Continued fraction for erfc (Lentz), accurate for large z.
  let f = z;
  for (let k = 60; k >= 1; k--) f = z + k / 2 / f;
  return sign * (1 - Math.exp(-z * z) / (Math.sqrt(Math.PI) * f));
}
