// Planning and learning with tabular methods (Sutton & Barto, April 2015 draft, Chapter 8): Dyna-Q and Dyna-Q+
// (Figure 8.4, §8.3), prioritized sweeping for deterministic environments (Figure 8.9), the mazes of Examples 8.1–8.4,
// full against sample backups (Figure 8.13) and trajectory sampling (Figure 8.14).
import type { Rng } from "../../domain/random";

// ---------- Mazes ----------
export interface Maze {
  rows: number;
  cols: number;
  start: [number, number];
  goal: [number, number];
  walls: readonly [number, number][];
}
export const ACTIONS: readonly [number, number][] = [[-1, 0], [1, 0], [0, 1], [0, -1]]; // up, down, right, left
export const ACTION_NAMES = ["up", "down", "right", "left"];

/** Figure 8.5: 6 × 9, start (2,0), goal (0,8); 47 open states. */
export const DYNA_MAZE: Maze = { rows: 6, cols: 9, start: [2, 0], goal: [0, 8], walls: [[1, 2], [2, 2], [3, 2], [4, 5], [0, 7], [1, 7], [2, 7]] };
const row3 = (from: number, to: number): [number, number][] => Array.from({ length: to - from + 1 }, (_, i) => [3, from + i]);
/** Figure 8.7: the gap in the barrier is on the right for the first 1000 steps, then on the left. */
export const BLOCKING_MAZE: [Maze, Maze] = [
  { rows: 6, cols: 9, start: [5, 3], goal: [0, 8], walls: row3(0, 7) },
  { rows: 6, cols: 9, start: [5, 3], goal: [0, 8], walls: row3(1, 8) },
];
/** Figure 8.8: the gap is on the left; after 3000 steps a second gap opens on the right. */
export const SHORTCUT_MAZE: [Maze, Maze] = [
  { rows: 6, cols: 9, start: [5, 3], goal: [0, 8], walls: row3(1, 8) },
  { rows: 6, cols: 9, start: [5, 3], goal: [0, 8], walls: row3(1, 7) },
];
/** Example 8.4: each cell of a maze becomes a k × k block (start and goal at the block's corner nearest the original). */
export function scaleMaze(m: Maze, k: number): Maze {
  const walls: [number, number][] = [];
  for (const [r, c] of m.walls) for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) walls.push([r * k + i, c * k + j]);
  return { rows: m.rows * k, cols: m.cols * k, start: [m.start[0] * k, m.start[1] * k], goal: [m.goal[0] * k, m.goal[1] * k + k - 1], walls };
}

export interface MazeEnv {
  maze: Maze;
  n: number; // number of cells (states), walls included as unreachable cells
  start: number;
  goal: number;
  wall: boolean[];
  step: (s: number, a: number) => { next: number; reward: number };
  openStates: number;
}
export function mazeEnv(m: Maze): MazeEnv {
  const n = m.rows * m.cols;
  const id = (r: number, c: number) => r * m.cols + c;
  const wall = new Array(n).fill(false);
  for (const [r, c] of m.walls) wall[id(r, c)] = true;
  const goal = id(m.goal[0], m.goal[1]);
  return {
    maze: m,
    n,
    start: id(m.start[0], m.start[1]),
    goal,
    wall,
    openStates: n - wall.filter(Boolean).length,
    step: (s, a) => {
      const r = Math.floor(s / m.cols) + ACTIONS[a][0];
      const c = (s % m.cols) + ACTIONS[a][1];
      const next = r < 0 || r >= m.rows || c < 0 || c >= m.cols || wall[id(r, c)] ? s : id(r, c);
      return { next, reward: next === goal ? 1 : 0 };
    },
  };
}
/** Shortest number of steps from start to goal (breadth-first search). */
export function shortestPath(env: MazeEnv): number {
  const dist = new Array(env.n).fill(-1);
  dist[env.start] = 0;
  const q = [env.start];
  for (let i = 0; i < q.length; i++) {
    const s = q[i];
    if (s === env.goal) return dist[s];
    for (let a = 0; a < 4; a++) {
      const { next } = env.step(s, a);
      if (dist[next] < 0) (dist[next] = dist[s] + 1), q.push(next);
    }
  }
  return Infinity;
}

// ---------- Dyna-Q and Dyna-Q+ ----------
export interface DynaConfig {
  n: number; // planning steps per real step
  alpha: number;
  gamma: number;
  epsilon: number;
  kappa?: number; // Dyna-Q+ bonus κ√τ (0 or undefined: Dyna-Q)
  bonusIn?: "backups" | "selection"; // §8.3: in planning backups (Dyna-Q+); Exercise 8.4: only in action selection
}
export interface DynaAgent {
  Q: number[][];
  model: Map<number, { next: number; reward: number }>[]; // per state: action → last observed outcome
  lastTried: number[][]; // time step at which each pair was last tried for real
  time: number;
  backups: number; // direct + planning backups made
}
export const newDynaAgent = (n: number): DynaAgent => ({
  Q: Array.from({ length: n }, () => [0, 0, 0, 0]),
  model: Array.from({ length: n }, () => new Map()),
  lastTried: Array.from({ length: n }, () => [0, 0, 0, 0]),
  time: 0,
  backups: 0,
});
const argmaxRandom = (xs: number[], rng: Rng) => {
  const m = Math.max(...xs);
  const best = xs.flatMap((x, i) => (x === m ? [i] : []));
  return best[Math.floor(rng() * best.length)];
};
const maxOf = (xs: number[]) => Math.max(...xs);
/** ε-greedy with ties broken at random (Example 8.1); with `bonusIn: "selection"` the greedy choice uses Q + κ√τ. */
export function dynaAction(ag: DynaAgent, s: number, cfg: DynaConfig, rng: Rng): number {
  if (rng() < cfg.epsilon) return Math.floor(rng() * 4);
  if (cfg.kappa && cfg.bonusIn === "selection") return argmaxRandom(ag.Q[s].map((q, a) => q + cfg.kappa! * Math.sqrt(ag.time - ag.lastTried[s][a])), rng);
  return argmaxRandom(ag.Q[s], rng);
}
const qBackup = (ag: DynaAgent, s: number, a: number, r: number, s2: number, terminal: boolean, cfg: DynaConfig) => {
  ag.Q[s][a] += cfg.alpha * (r + (terminal ? 0 : cfg.gamma * maxOf(ag.Q[s2])) - ag.Q[s][a]);
  ag.backups++;
};
/**
 * One real step of Dyna-Q (Figure 8.4): act, direct Q-learning backup, model update, then n planning backups from
 * random previously observed pairs. Dyna-Q+ (§8.3, footnote p. 206) plans with reward R + κ√τ, may also plan from
 * actions never tried in a visited state, and models those as leading back to the same state with reward 0.
 */
export function dynaStep(env: MazeEnv, ag: DynaAgent, s: number, cfg: DynaConfig, rng: Rng): { next: number; reward: number; done: boolean } {
  const a = dynaAction(ag, s, cfg, rng);
  const { next, reward } = env.step(s, a);
  const done = next === env.goal;
  ag.time++;
  qBackup(ag, s, a, reward, next, done, cfg);
  ag.model[s].set(a, { next, reward });
  ag.lastTried[s][a] = ag.time;
  const plus = !!cfg.kappa && cfg.bonusIn !== "selection";
  const seen: number[] = [];
  for (let x = 0; x < ag.model.length; x++) if (ag.model[x].size) seen.push(x);
  for (let k = 0; k < cfg.n; k++) {
    const ps = seen[Math.floor(rng() * seen.length)];
    let pa: number;
    let out: { next: number; reward: number };
    if (plus) {
      pa = Math.floor(rng() * 4);
      out = ag.model[ps].get(pa) ?? { next: ps, reward: 0 };
    } else {
      const acts = [...ag.model[ps].keys()];
      pa = acts[Math.floor(rng() * acts.length)];
      out = ag.model[ps].get(pa)!;
    }
    const bonus = plus ? cfg.kappa! * Math.sqrt(ag.time - ag.lastTried[ps][pa]) : 0;
    qBackup(ag, ps, pa, out.reward + bonus, out.next, out.next === env.goal, cfg);
  }
  return { next, reward, done };
}
/** Example 8.1: steps per episode for `episodes` episodes (the agent returns to the start after each). */
export function dynaEpisodes(env: MazeEnv, cfg: DynaConfig, episodes: number, rng: Rng, ag = newDynaAgent(env.n)): number[] {
  const steps: number[] = [];
  for (let e = 0; e < episodes; e++) {
    let s = env.start;
    let k = 0;
    for (;;) {
      const r = dynaStep(env, ag, s, cfg, rng);
      k++;
      if (r.done) break;
      s = r.next;
    }
    steps.push(k);
  }
  return steps;
}
/** Examples 8.2–8.3: cumulative reward after each time step, with the maze switching from `mazes[0]` to `mazes[1]` at `changeAt`. */
export function dynaChanging(mazes: [Maze, Maze], changeAt: number, total: number, cfg: DynaConfig, rng: Rng, ag: DynaAgent = newDynaAgent(mazes[0].rows * mazes[0].cols)): number[] {
  const envs = mazes.map(mazeEnv);
  const cum: number[] = [];
  let reward = 0;
  let s = envs[0].start;
  for (let t = 0; t < total; t++) {
    const env = envs[t < changeAt ? 0 : 1];
    const r = dynaStep(env, ag, s, cfg, rng);
    reward += r.reward;
    cum.push(reward);
    s = r.done ? env.start : r.next;
  }
  return cum;
}
/** The greedy action in each state (null if all of its action values are equal), as drawn in Figure 8.6. */
export const greedyArrows = (Q: number[][]) => Q.map((q) => (q.every((x) => x === q[0]) ? null : q.indexOf(maxOf(q))));
/** Does the greedy policy (first maximum) reach the goal from the start in exactly the shortest number of steps? */
export function greedyIsOptimal(env: MazeEnv, Q: number[][], optimal = shortestPath(env)): boolean {
  let s = env.start;
  for (let k = 0; k < optimal; k++) {
    const q = Q[s];
    if (q.every((x) => x === q[0])) return false;
    s = env.step(s, q.indexOf(maxOf(q))).next;
    if (s === env.goal) return k + 1 === optimal;
  }
  return false;
}

/** Length of the greedy path (first maximum) from the start, or Infinity if it does not reach the goal within `limit` steps. */
export function greedyPathLength(env: MazeEnv, Q: number[][], limit = 200): number {
  let s = env.start;
  for (let k = 1; k <= limit; k++) {
    s = env.step(s, Q[s].indexOf(maxOf(Q[s]))).next;
    if (s === env.goal) return k;
  }
  return Infinity;
}
/** Expected length of an episode under uniformly random actions (Example 8.1's first episode, before anything is learned). */
export function randomWalkEpisodeLength(env: MazeEnv): number {
  let V = new Array(env.n).fill(0);
  for (let it = 0; it < 1_000_000; it++) {
    let d = 0;
    const W = V.map((_, s) => (s === env.goal || env.wall[s] ? 0 : 1 + [0, 1, 2, 3].reduce((x, a) => x + 0.25 * V[env.step(s, a).next], 0)));
    W.forEach((x, i) => (d = Math.max(d, Math.abs(x - V[i]))));
    V = W;
    if (d < 1e-10) break;
  }
  return V[env.start];
}

// ---------- Prioritized sweeping (Figure 8.9, deterministic) ----------
/**
 * One real step of prioritized sweeping: act, update the model, queue (S, A) if its priority exceeds θ, then up to n
 * backups from the top of the queue, each queueing the predecessors of the backed-up state.
 */
export function prioritizedStep(env: MazeEnv, ag: DynaAgent, pq: Map<string, number>, preds: Set<string>[], s: number, cfg: DynaConfig & { theta: number }, rng: Rng) {
  const a = dynaAction(ag, s, cfg, rng);
  const { next, reward } = env.step(s, a);
  const done = next === env.goal;
  ag.time++;
  ag.model[s].set(a, { next, reward });
  preds[next].add(`${s},${a}`);
  const target = (st: number, ac: number) => {
    const o = ag.model[st].get(ac)!;
    return o.reward + (o.next === env.goal ? 0 : cfg.gamma * maxOf(ag.Q[o.next]));
  };
  const push = (st: number, ac: number, p: number) => {
    const k = `${st},${ac}`;
    if (p > cfg.theta && p > (pq.get(k) ?? -1)) pq.set(k, p);
  };
  push(s, a, Math.abs(target(s, a) - ag.Q[s][a]));
  for (let i = 0; i < cfg.n && pq.size; i++) {
    let top = "";
    let best = -1;
    for (const [k, p] of pq) if (p > best) (best = p), (top = k);
    pq.delete(top);
    const [ps, pa] = top.split(",").map(Number);
    ag.Q[ps][pa] += cfg.alpha * (target(ps, pa) - ag.Q[ps][pa]);
    ag.backups++;
    for (const pk of preds[ps]) {
      const [bs, ba] = pk.split(",").map(Number);
      push(bs, ba, Math.abs(target(bs, ba) - ag.Q[bs][ba]));
    }
  }
  return { next, reward, done };
}
/**
 * Example 8.4: backups made until the greedy policy is optimal (checked after every episode), for Dyna-Q or prioritized
 * sweeping with at most n backups per real step. Prioritized sweeping makes no direct backup of its own (Figure 8.9).
 */
export function backupsUntilOptimal(m: Maze, method: "dyna-q" | "prioritized", cfg: DynaConfig & { theta?: number }, rng: Rng, maxSteps = 2_000_000): number {
  const env = mazeEnv(m);
  const opt = shortestPath(env);
  const ag = newDynaAgent(env.n);
  const pq = new Map<string, number>();
  const preds = Array.from({ length: env.n }, () => new Set<string>());
  let s = env.start;
  for (let t = 0; t < maxSteps; t++) {
    const r = method === "dyna-q" ? dynaStep(env, ag, s, cfg, rng) : prioritizedStep(env, ag, pq, preds, s, { ...cfg, theta: cfg.theta ?? 1e-4 }, rng);
    if (r.done) {
      if (greedyIsOptimal(env, ag.Q, opt)) return ag.backups;
      s = env.start;
    } else s = r.next;
  }
  return Infinity;
}

// ---------- Full against sample backups (Figure 8.13) ----------
/** The RMS error after t sample backups (sample averages) of b equally likely successors, initial error 1: √((b − 1)/(b t)). */
export const sampleBackupError = (b: number, t: number) => (t === 0 ? 1 : Math.sqrt((b - 1) / (b * t)));
// ---------- Trajectory sampling (Figure 8.14) ----------
/**
 * A random task of §8.6: from each of `nStates` states two actions, each leading to one of b next states (equally likely,
 * chosen at random per pair), and on every transition a 0.1 chance of ending the episode instead. The draft does not
 * say how rewards are set; we draw an expected reward for each (state, action, next state) from a standard normal, and
 * the reward for ending is drawn the same way per (state, action). State 0 is the start.
 */
export interface RandomTask {
  nStates: number;
  b: number;
  next: Int32Array[]; // [s*2 + a] → b successor states
  reward: Float64Array[]; // [s*2 + a] → b rewards for the successors
  endReward: Float64Array; // [s*2 + a] → reward when the episode ends
}
export function randomTask(nStates: number, b: number, rng: Rng): RandomTask {
  const gauss = () => {
    const u = Math.max(rng(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  };
  const next: Int32Array[] = [];
  const reward: Float64Array[] = [];
  const endReward = new Float64Array(nStates * 2);
  for (let i = 0; i < nStates * 2; i++) {
    next.push(Int32Array.from({ length: b }, () => Math.floor(rng() * nStates)));
    reward.push(Float64Array.from({ length: b }, gauss));
    endReward[i] = gauss();
  }
  return { nStates, b, next, reward, endReward };
}
/** The full backup (8.1) of Q(s, a) in a random task (undiscounted, termination probability 0.1). */
export function fullBackup(task: RandomTask, Q: Float64Array, s: number, a: number) {
  const i = s * 2 + a;
  let v = 0.1 * task.endReward[i];
  for (let k = 0; k < task.b; k++) {
    const s2 = task.next[i][k];
    v += (0.9 / task.b) * (task.reward[i][k] + Math.max(Q[s2 * 2], Q[s2 * 2 + 1]));
  }
  Q[i] = v;
}
/** The value of the start state under the greedy policy of Q, by iterative evaluation (the draft's measure). */
export function greedyStartValue(task: RandomTask, Q: Float64Array): number {
  const pol = new Int8Array(task.nStates);
  for (let s = 0; s < task.nStates; s++) pol[s] = Q[s * 2 + 1] > Q[s * 2] ? 1 : 0;
  let V = new Float64Array(task.nStates);
  for (let it = 0; it < 1000; it++) {
    const W = new Float64Array(task.nStates);
    let delta = 0;
    for (let s = 0; s < task.nStates; s++) {
      const i = s * 2 + pol[s];
      let v = 0.1 * task.endReward[i];
      for (let k = 0; k < task.b; k++) v += (0.9 / task.b) * (task.reward[i][k] + V[task.next[i][k]]);
      W[s] = v;
      delta = Math.max(delta, Math.abs(v - V[s]));
    }
    V = W;
    if (delta < 1e-9) break;
  }
  return V[0];
}
/**
 * Figure 8.14: the start state's greedy value after every `every` full backups, distributing the backups either by
 * sweeping all state–action pairs in turn ("uniform") or along simulated ε-greedy (ε = 0.1) episodes from the start ("on-policy").
 */
export function trajectorySampling(task: RandomTask, mode: "uniform" | "on-policy", backups: number, every: number, rng: Rng): number[] {
  const Q = new Float64Array(task.nStates * 2);
  const out = [greedyStartValue(task, Q)];
  let done = 0;
  let sweep = 0;
  let s = 0;
  while (done < backups) {
    if (mode === "uniform") {
      fullBackup(task, Q, Math.floor(sweep / 2) % task.nStates, sweep % 2);
      sweep++;
    } else {
      const g = Q[s * 2 + 1] > Q[s * 2] ? 1 : Q[s * 2 + 1] < Q[s * 2] ? 0 : rng() < 0.5 ? 1 : 0;
      const a = rng() < 0.1 ? (rng() < 0.5 ? 0 : 1) : g;
      fullBackup(task, Q, s, a);
      s = rng() < 0.1 ? 0 : task.next[s * 2 + a][Math.floor(rng() * task.b)]; // ending the episode restarts at the start
    }
    done++;
    if (done % every === 0) out.push(greedyStartValue(task, Q));
  }
  return out;
}

// ---------- Random-sample one-step tabular Q-planning (Figure 8.1) ----------
/**
 * Repeat `steps` times: pick a state and action at random, ask the sample model for R and S′, and make a Q-learning
 * backup. On a maze the model is the maze itself (deterministic); walls are never picked as states.
 */
export function qPlanning(env: MazeEnv, Q: number[][], steps: number, alpha: number, gamma: number, rng: Rng) {
  const open: number[] = [];
  for (let s = 0; s < env.n; s++) if (!env.wall[s] && s !== env.goal) open.push(s);
  for (let k = 0; k < steps; k++) {
    const s = open[Math.floor(rng() * open.length)];
    const a = Math.floor(rng() * 4);
    const { next, reward } = env.step(s, a);
    Q[s][a] += alpha * (reward + (next === env.goal ? 0 : gamma * Math.max(...Q[next])) - Q[s][a]);
  }
}
