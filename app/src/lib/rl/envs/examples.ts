// Environments from the April 2015 draft used by the DP, Monte Carlo and TD laboratories, all as FiniteMDPs, so the
// same definitions serve dynamic programming (which reads the dynamics) and sampling methods (which only sample them).
//
//   gamblersProblem   Example 4.3 (printed pp. 100–101): capital 1–99, stakes 0…min(s, 100 − s), +1 on reaching 100
//   randomWalk        Example 6.2 (printed p. 149): states A–E, start C, +1 on the right; true values 1/6 … 5/6
//   windyGridworld    Example 6.5 (printed pp. 155–157, Figure 6.10): 7 × 10, wind 0 0 0 1 1 1 2 2 1 0, reward −1
//   cliffWalking      Example 6.6 (printed pp. 158–159, Figure 6.13): 4 × 12, −100 into the cliff and back to start
//   gridworld5x5      Examples 3.8 and 3.12 (printed pp. 72–73, 78–79, Figures 3.5 and 3.8): continuing, A → A′ (+10),
//                     B → B′ (+5), −1 for bumping into the edge
// Grid layouts were read from the page images of Figures 3.5, 3.8, 6.10 and 6.13.
import type { FiniteMDP } from "../mdp";

/** Grid metadata for drawing: state s sits at cells[s] = [row, col] (null for an off-grid terminal). */
export interface GridInfo {
  rows: number;
  cols: number;
  cells: ([number, number] | null)[];
  start: number;
  goal: number[];
  cliff?: [number, number][];
  wind?: number[];
  marks?: Record<number, string>; // letters drawn in cells (A, B, A′, B′ of Example 3.8)
}
export type GridMDP = FiniteMDP & { grid: GridInfo };

export const GRID_MOVES = ["up", "down", "right", "left"] as const;
const DELTA: Record<(typeof GRID_MOVES)[number], [number, number]> = { up: [-1, 0], down: [1, 0], right: [0, 1], left: [0, -1] };

/** Example 4.3. State index = capital (0 and 100 are terminal); action index = stake. */
export function gamblersProblem(ph: number, goal = 100): FiniteMDP {
  if (!(ph >= 0 && ph <= 1)) throw new RangeError("p_h must lie in [0, 1]");
  const n = goal + 1;
  const maxStake = Math.floor(goal / 2);
  const states = Array.from({ length: n }, (_, s) => `$${s}`);
  const actions = Array.from({ length: maxStake + 1 }, (_, a) => `stake ${a}`);
  const dynamics = states.map((_, s) =>
    actions.map((_, a) => {
      if (s === 0 || s === goal || a > Math.min(s, goal - s)) return [];
      if (a === 0) return [{ next: s, reward: 0, prob: 1 }];
      const win = s + a;
      return [
        { next: win, reward: win === goal ? 1 : 0, prob: ph },
        { next: s - a, reward: 0, prob: 1 - ph },
      ];
    }),
  );
  return { states, terminal: states.map((_, s) => s === 0 || s === goal), actions, dynamics };
}

/** Example 6.2: index 0 and 6 are the terminal ends, 1–5 are A–E. One action ("walk"): left or right with p = ½. */
export function randomWalk(): FiniteMDP {
  const states = ["left end", "A", "B", "C", "D", "E", "right end"];
  const dynamics = states.map((_, s) =>
    s === 0 || s === 6
      ? [[]]
      : [[{ next: s - 1, reward: 0, prob: 0.5 }, { next: s + 1, reward: s + 1 === 6 ? 1 : 0, prob: 0.5 }]],
  );
  return { states, terminal: states.map((_, s) => s === 0 || s === 6), actions: ["walk"], dynamics };
}
export const RANDOM_WALK_START = 3; // C
export const RANDOM_WALK_TRUE = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 0];

function gridMdp(rows: number, cols: number, start: [number, number], goals: [number, number][], move: (r: number, c: number, a: (typeof GRID_MOVES)[number]) => { to: [number, number]; reward: number }, extra: Partial<GridInfo> = {}): GridMDP {
  const id = (r: number, c: number) => r * cols + c;
  const n = rows * cols;
  const isGoal = (s: number) => goals.some(([r, c]) => id(r, c) === s);
  const states = Array.from({ length: n }, (_, s) => `(${Math.floor(s / cols)},${s % cols})`);
  const dynamics = states.map((_, s) => {
    if (isGoal(s)) return GRID_MOVES.map(() => []);
    const r = Math.floor(s / cols);
    const c = s % cols;
    return GRID_MOVES.map((a) => {
      const m = move(r, c, a);
      return [{ next: id(m.to[0], m.to[1]), reward: m.reward, prob: 1 }];
    });
  });
  return {
    states,
    terminal: states.map((_, s) => isGoal(s)),
    actions: [...GRID_MOVES],
    dynamics,
    grid: { rows, cols, cells: states.map((_, s) => [Math.floor(s / cols), s % cols]), start: id(...start), goal: goals.map(([r, c]) => id(r, c)), ...extra },
  };
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Example 6.5. Rows counted from the top (row 0); S at row 3, column 0; G at row 3, column 7. */
export const WINDY_WIND = [0, 0, 0, 1, 1, 1, 2, 2, 1, 0];
export function windyGridworld(): GridMDP {
  const rows = 7;
  const cols = 10;
  return gridMdp(
    rows,
    cols,
    [3, 0],
    [[3, 7]],
    (r, c, a) => {
      // The wind of the column the agent starts from pushes it up, on top of its own move; the grid edges stop it.
      const [dr, dc] = DELTA[a];
      return { to: [clamp(r + dr - WINDY_WIND[c], 0, rows - 1), clamp(c + dc, 0, cols - 1)], reward: -1 };
    },
    { wind: WINDY_WIND },
  );
}

/** Example 6.6. S bottom-left, G bottom-right, the cliff between them; stepping into it: −100 and back to S. */
export function cliffWalking(): GridMDP {
  const rows = 4;
  const cols = 12;
  const cliff: [number, number][] = Array.from({ length: cols - 2 }, (_, i) => [rows - 1, i + 1]);
  const inCliff = (r: number, c: number) => r === rows - 1 && c >= 1 && c <= cols - 2;
  return gridMdp(
    rows,
    cols,
    [rows - 1, 0],
    [[rows - 1, cols - 1]],
    (r, c, a) => {
      const [dr, dc] = DELTA[a];
      const nr = clamp(r + dr, 0, rows - 1);
      const nc = clamp(c + dc, 0, cols - 1);
      return inCliff(nr, nc) ? { to: [rows - 1, 0], reward: -100 } : { to: [nr, nc], reward: -1 };
    },
    { cliff },
  );
}

/**
 * Examples 3.8 and 3.12: the 5 × 5 gridworld of Figure 3.5a (rows from the top, state = row · 5 + column). A is at
 * row 0, column 1 and B at row 0, column 3; every action in A gives +10 and moves to A′ (row 4, column 1), every
 * action in B gives +5 and moves to B′ (row 2, column 3). Elsewhere a move off the grid leaves the agent in place with
 * reward −1, and any other move gives 0. The task is continuing: no state is terminal (the draft uses γ = 0.9).
 */
export const GRID5 = { A: 1, B: 3, A2: 21, B2: 13 } as const;
export function gridworld5x5(): GridMDP {
  const n = 5;
  const id = (r: number, c: number) => r * n + c;
  const states = Array.from({ length: n * n }, (_, s) => `(${Math.floor(s / n)},${s % n})`);
  const dynamics = states.map((_, s) =>
    GRID_MOVES.map((a) => {
      if (s === GRID5.A) return [{ next: GRID5.A2, reward: 10, prob: 1 }];
      if (s === GRID5.B) return [{ next: GRID5.B2, reward: 5, prob: 1 }];
      const [dr, dc] = DELTA[a];
      const r = Math.floor(s / n) + dr;
      const c = (s % n) + dc;
      return r < 0 || r >= n || c < 0 || c >= n ? [{ next: s, reward: -1, prob: 1 }] : [{ next: id(r, c), reward: 0, prob: 1 }];
    }),
  );
  return {
    states,
    terminal: states.map(() => false),
    actions: [...GRID_MOVES],
    dynamics,
    grid: { rows: n, cols: n, cells: states.map((_, s) => [Math.floor(s / n), s % n]), start: -1, goal: [], marks: { [GRID5.A]: "A", [GRID5.B]: "B", [GRID5.A2]: "A′", [GRID5.B2]: "B′" } },
  };
}
