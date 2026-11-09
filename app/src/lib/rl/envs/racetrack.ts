// The racetrack of Exercise 5.9 (Sutton & Barto, April 2015 draft, printed pp. 141–142, Figure 5.11), as a finite
// MDP. The two tracks were read from the page image at 300 dpi: row 0 is the top row of the figure; each row lists the
// first and last track column. The start line is the bottom row; the finish line is the rightmost column of the top rows.
//
// Stated in the draft: discrete positions and velocities; each velocity component is 0–4 and they cannot both be 0;
// nine actions change each component by −1, 0 or +1; −1 per step on the track, −5 for trying to drive off it; the car
// never actually leaves the track, but always advances at least one cell; on half of the steps the position is
// displaced one extra cell forward or to the right; episodes start at a random start cell and end on crossing the finish.
//
// Our reading of what the draft leaves open (stated in the lab):
//   - "forward" is up; the extra cell is up or right with equal probability (each 1/4 of all steps);
//   - the velocity starts at (0, 0); an action that would leave both components 0 sets the vertical component to 1;
//   - a move follows the straight line from cell to cell; if that line reaches a finish cell the episode ends (−1);
//     otherwise, if it leaves the track, the car is moved one cell up (or, if that cell is off the track, one cell to
//     the right), its velocity becomes that single-cell move, and the reward is −5.
import type { FiniteMDP, Transition } from "../mdp";

export interface Track {
  name: string;
  rows: [number, number][]; // [first, last] track column of each row, top to bottom
  finishRows: number[]; // rows whose last column is the finish line
}

const span = (n: number, v: [number, number]) => Array.from({ length: n }, () => v);
/** Figure 5.11, left: 32 rows × 17 columns. */
export const TRACK_LEFT: Track = {
  name: "left turn (Figure 5.11, left)",
  rows: [[3, 16], [2, 16], [2, 16], [1, 16], [0, 16], [0, 16], [0, 9], ...span(7, [0, 8]), ...span(8, [1, 8]), ...span(7, [2, 8]), ...span(3, [3, 8])],
  finishRows: [0, 1, 2, 3, 4, 5],
};
/** Figure 5.11, right: 30 rows × 32 columns. */
export const TRACK_RIGHT: Track = {
  name: "wide turn (Figure 5.11, right)",
  rows: [
    [16, 31], [13, 31], [12, 31], [11, 31], [11, 31], [11, 31], [11, 31], [12, 31], [13, 31], [14, 29], [14, 26], [14, 25], [14, 23], [14, 22],
    [13, 22], [12, 22], [11, 22], [10, 22], [9, 22], [8, 22], [7, 22], [6, 22], [5, 22], [4, 22], [3, 22], [2, 22], [1, 22], [0, 22], [0, 22], [0, 22],
  ],
  finishRows: [0, 1, 2, 3, 4, 5, 6, 7, 8],
};

export const RT_ACTIONS: [number, number][] = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => [dy, dx] as [number, number])); // [Δ up, Δ right]

export interface RacetrackMdp extends FiniteMDP {
  track: Track;
  cells: [number, number][]; // index → [row, col]
  starts: number[]; // start states (start-line cells, velocity 0)
  stateOf: (row: number, col: number, vy: number, vx: number) => number; // −1 if not a state
  decode: (s: number) => { row: number; col: number; vy: number; vx: number };
}

export function racetrack(track: Track): RacetrackMdp {
  const nRows = track.rows.length;
  const onTrack = (r: number, c: number) => r >= 0 && r < nRows && c >= track.rows[r][0] && c <= track.rows[r][1];
  const isFinish = (r: number, c: number) => track.finishRows.includes(r) && c === track.rows[r][1];
  const cells: [number, number][] = [];
  const cellIndex = new Map<string, number>();
  track.rows.forEach(([a, b], r) => {
    for (let c = a; c <= b; c++) {
      cellIndex.set(`${r},${c}`, cells.length);
      cells.push([r, c]);
    }
  });
  const V = 5; // velocities 0–4
  const stateOf = (r: number, c: number, vy: number, vx: number) => {
    const i = cellIndex.get(`${r},${c}`);
    return i === undefined ? -1 : 1 + (i * V + vy) * V + vx;
  };
  const nStates = 1 + cells.length * V * V; // state 0 is the terminal state
  const decode = (s: number) => {
    const k = s - 1;
    const i = Math.floor(k / (V * V));
    return { row: cells[i][0], col: cells[i][1], vy: Math.floor(k / V) % V, vx: k % V };
  };

  /** Where a move from (r, c) by (dy up, dx right) ends: finish, crash, or a new cell. */
  const move = (r: number, c: number, dy: number, dx: number): { kind: "finish" } | { kind: "crash" } | { kind: "move"; r: number; c: number } => {
    const n = 4 * Math.max(dy, dx);
    for (let k = 1; k <= n; k++) {
      const rr = Math.round(r - (dy * k) / n);
      const cc = Math.round(c + (dx * k) / n);
      if (onTrack(rr, cc) && isFinish(rr, cc)) return { kind: "finish" };
      if (!onTrack(rr, cc)) return { kind: "crash" };
    }
    return { kind: "move", r: r - dy, c: c + dx };
  };

  const states: string[] = ["finish"];
  const dynamics: Transition[][][] = [RT_ACTIONS.map(() => [])];
  for (let s = 1; s < nStates; s++) {
    const { row, col, vy, vx } = decode(s);
    states.push(`(${row},${col}) v=(${vy},${vx})`);
    dynamics.push(
      RT_ACTIONS.map(([ay, ax]) => {
        let ny = Math.min(4, Math.max(0, vy + ay));
        const nx = Math.min(4, Math.max(0, vx + ax));
        if (ny === 0 && nx === 0) ny = 1;
        const outcomes = new Map<string, Transition>();
        const add = (next: number, reward: number, prob: number) => {
          const key = `${next},${reward}`;
          const t = outcomes.get(key);
          outcomes.set(key, t ? { ...t, prob: t.prob + prob } : { next, reward, prob });
        };
        for (const [ey, ex, p] of [[0, 0, 0.5], [1, 0, 0.25], [0, 1, 0.25]] as const) {
          const m = move(row, col, ny + ey, nx + ex);
          if (m.kind === "finish") add(0, -1, p);
          else if (m.kind === "move") add(stateOf(m.r, m.c, ny, nx), -1, p);
          else if (onTrack(row - 1, col)) add(isFinish(row - 1, col) ? 0 : stateOf(row - 1, col, 1, 0), -5, p);
          else add(isFinish(row, col + 1) ? 0 : stateOf(row, col + 1, 0, 1), -5, p);
        }
        return [...outcomes.values()];
      }),
    );
  }
  const last = nRows - 1;
  const starts: number[] = [];
  for (let c = track.rows[last][0]; c <= track.rows[last][1]; c++) starts.push(stateOf(last, c, 0, 0));
  return { states, terminal: states.map((_, s) => s === 0), actions: RT_ACTIONS.map(([y, x]) => `Δup ${y}, Δright ${x}`), dynamics, track, cells, starts, stateOf, decode };
}

/** A trajectory of the greedy policy from a start state, without the random extra cell (noise off) unless asked. */
export function greedyTrajectory(m: RacetrackMdp, pi: readonly number[], start: number, maxSteps = 500): { cells: [number, number][]; reward: number; finished: boolean } {
  let s = start;
  const cells: [number, number][] = [];
  let reward = 0;
  for (let k = 0; k < maxSteps; k++) {
    const d = m.decode(s);
    cells.push([d.row, d.col]);
    // The noise-free outcome is the one with probability 0.5 (or more, when outcomes merge): the first listed.
    const o = m.dynamics[s][pi[s]][0];
    reward += o.reward;
    if (o.next === 0) return { cells, reward, finished: true };
    s = o.next;
  }
  return { cells, reward, finished: false };
}
