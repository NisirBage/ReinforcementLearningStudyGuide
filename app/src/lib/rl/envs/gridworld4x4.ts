// The 4×4 gridworld of Example 4.1 (Sutton & Barto, April 2015 draft, printed p. 92):
// nonterminal states 1..14, one terminal state shown in two corners, actions up/down/right/left,
// moves off the grid leave the state unchanged, reward −1 on every transition, undiscounted episodic task.
import type { FiniteMDP } from "../mdp";

export const GRID_ACTIONS = ["up", "down", "right", "left"] as const;

/** Index 0 is the terminal state; indices 1..14 are the book's state numbers. */
export function gridworld4x4(): FiniteMDP {
  const states = ["T", ...Array.from({ length: 14 }, (_, i) => String(i + 1))];
  // Cell c (0..15, row-major) holds state c, except cells 0 and 15, which are the terminal state.
  const stateOfCell = (cell: number) => (cell === 0 || cell === 15 ? 0 : cell);
  const move = (cell: number, a: (typeof GRID_ACTIONS)[number]) => {
    const r = Math.floor(cell / 4);
    const c = cell % 4;
    const [nr, nc] = a === "up" ? [r - 1, c] : a === "down" ? [r + 1, c] : a === "right" ? [r, c + 1] : [r, c - 1];
    return nr < 0 || nr > 3 || nc < 0 || nc > 3 ? cell : nr * 4 + nc;
  };
  const dynamics = states.map((_, s) =>
    s === 0 ? GRID_ACTIONS.map(() => []) : GRID_ACTIONS.map((a) => [{ next: stateOfCell(move(s, a)), reward: -1, prob: 1 }]),
  );
  return { states, terminal: states.map((_, s) => s === 0), actions: [...GRID_ACTIONS], dynamics };
}

/** Values of the 16 cells in the book's row-major layout (both terminal corners show 0). */
export const toCells = (v: readonly number[]): number[] => Array.from({ length: 16 }, (_, cell) => (cell === 0 || cell === 15 ? v[0] : v[cell]));
