// Tic-tac-toe (Sutton & Barto, April 2015 draft, §1.5, Figure 1.1, Exercises 1.1–1.5).
//
// We always play X and move first; the opponent plays O. A board is a 9-character string of "X", "O" and ".",
// row by row. Values are kept for the positions reached after our own moves (afterstates, as §6.6 says of this
// example): 1 when X has three in a row, 0 when O has or the board is full ("draws and losses equally bad"),
// 0.5 otherwise to start.
//
// The learner of §1.5: mostly greedy (move to the position of highest value), sometimes exploratory (a random
// move among the other moves). After each greedy move the value of our previous afterstate moves a fraction α
// of the way toward the value of the new one, V(s) ← V(s) + α[V(s′) − V(s)]; exploratory moves cause no such
// update. Where the draft leaves details open, our reading (stated in the lab):
//   - the backup pairs successive afterstates of ours, and when the opponent ends the game its final position
//     (worth 0) is the last "later state";
//   - an exploratory move is a uniformly random choice among the non-greedy moves;
//   - "reduced properly over time" is a per-position step size 1/n (n = updates of that position so far),
//     used when `alpha` is "1/n".
//
// Because the opponent is a fixed, known stochastic player here, the true probabilities of winning are computed
// exactly by recursion over the game tree, so learned values and learned policies can be checked against them.
import type { Rng } from "../../../domain/random";

export type Mark = "X" | "O";
export type Board = string;
export const EMPTY: Board = ".........";
export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6],
];

export function winner(b: Board): Mark | null {
  for (const [i, j, k] of LINES) if (b[i] !== "." && b[i] === b[j] && b[j] === b[k]) return b[i] as Mark;
  return null;
}
export const isFull = (b: Board) => !b.includes(".");
export const isTerminal = (b: Board) => winner(b) !== null || isFull(b);
export const moves = (b: Board): number[] => [...b].flatMap((c, i) => (c === "." ? [i] : []));
export const play = (b: Board, i: number, m: Mark): Board => b.slice(0, i) + m + b.slice(i + 1);
/** Whose turn it is (X moves first). */
export const toMove = (b: Board): Mark => ([...b].filter((c) => c === "X").length === [...b].filter((c) => c === "O").length ? "X" : "O");

/** The value of a finished game to us: 1 if X won, 0 for a loss or a draw (§1.5 counts them equally bad). */
export const terminalValue = (b: Board) => (winner(b) === "X" ? 1 : 0);

/** Every position reachable from the empty board with X first, stopping at wins and full boards. */
export function reachablePositions(): Set<Board> {
  const seen = new Set<Board>([EMPTY]);
  const stack = [EMPTY];
  while (stack.length) {
    const b = stack.pop()!;
    if (isTerminal(b)) continue;
    const m = toMove(b);
    for (const i of moves(b)) {
      const n = play(b, i, m);
      if (!seen.has(n)) (seen.add(n), stack.push(n));
    }
  }
  return seen;
}

/** The 8 symmetries of the square as index maps: the board at position i of the image is b[perm[i]]. */
export const SYMMETRIES: readonly number[][] = (() => {
  const rot = [6, 3, 0, 7, 4, 1, 8, 5, 2]; // 90° clockwise
  const flip = [2, 1, 0, 5, 4, 3, 8, 7, 6]; // left–right
  const compose = (p: number[], q: number[]) => p.map((i) => q[i]);
  const out: number[][] = [];
  let r = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let k = 0; k < 4; k++) {
    out.push(r, compose(flip, r));
    r = compose(rot, r);
  }
  return out;
})();
/** The representative of a position's symmetry class (the smallest of its 8 images). */
export function canonical(b: Board): Board {
  let best = b;
  for (const p of SYMMETRIES) {
    const img = p.map((i) => b[i]).join("");
    if (img < best) best = img;
  }
  return best;
}

// ---------- Opponents ----------
export type OpponentKind = "random" | "defensive";
/** The opponent's move probabilities at a position where O is to move. */
export function opponentMoves(kind: OpponentKind, b: Board): { move: number; p: number }[] {
  let cands = moves(b);
  if (kind === "defensive") {
    // Completes its own line if it can, otherwise blocks ours if it must, otherwise plays at random.
    const wins = cands.filter((i) => winner(play(b, i, "O")) === "O");
    const blocks = cands.filter((i) => winner(play(b, i, "X")) === "X");
    if (wins.length) cands = wins;
    else if (blocks.length) cands = blocks;
  }
  return cands.map((move) => ({ move, p: 1 / cands.length }));
}
function sample(dist: { move: number; p: number }[], rng: Rng): number {
  let u = rng();
  for (const d of dist) if ((u -= d.p) < 0) return d.move;
  return dist[dist.length - 1].move;
}

// ---------- Exact values against a known opponent ----------
/**
 * The true probability of winning from each of our afterstates when we play optimally against `kind`
 * (what the learner's values converge to, p. 13): W(s) = Σ_o p(o|s) max_x W(s after o and x).
 */
export function optimalAfterstateValues(kind: OpponentKind): Map<Board, number> {
  const memo = new Map<Board, number>();
  const W = (s: Board): number => {
    const hit = memo.get(s);
    if (hit !== undefined) return hit;
    let v: number;
    if (isTerminal(s)) v = terminalValue(s);
    else {
      v = 0;
      for (const { move, p } of opponentMoves(kind, s)) {
        const t = play(s, move, "O");
        v += p * (isTerminal(t) ? terminalValue(t) : Math.max(...moves(t).map((i) => W(play(t, i, "X")))));
      }
    }
    memo.set(s, v);
    return v;
  };
  W(EMPTY.replace(".", "X")); // fill the table from every first move
  for (const i of moves(EMPTY)) W(play(EMPTY, i, "X"));
  return memo;
}
/** The best possible probability of winning a game against `kind`. */
export function optimalWinProbability(kind: OpponentKind): number {
  const W = optimalAfterstateValues(kind);
  return Math.max(...moves(EMPTY).map((i) => W.get(play(EMPTY, i, "X"))!));
}

export type XPolicy = (b: Board) => { move: number; p: number }[];
/** Exact probabilities of a win, a draw and a loss when our (possibly stochastic) policy plays `kind`. */
export function evaluatePolicy(policy: XPolicy, kind: OpponentKind): { win: number; draw: number; loss: number } {
  const memo = new Map<Board, [number, number, number]>();
  const go = (b: Board): [number, number, number] => {
    const w = winner(b);
    if (w === "X") return [1, 0, 0];
    if (w === "O") return [0, 0, 1];
    if (isFull(b)) return [0, 1, 0];
    const hit = memo.get(b);
    if (hit) return hit;
    const dist = toMove(b) === "X" ? policy(b) : opponentMoves(kind, b);
    const r: [number, number, number] = [0, 0, 0];
    for (const { move, p } of dist) {
      const sub = go(play(b, move, toMove(b)));
      for (let k = 0; k < 3; k++) r[k] += p * sub[k];
    }
    memo.set(b, r);
    return r;
  };
  const [win, draw, loss] = go(EMPTY);
  return { win, draw, loss };
}

/** The greedy policy of a value table over afterstates (ties go to the lowest-numbered square). */
export function greedyPolicy(V: (s: Board) => number): XPolicy {
  return (b) => [{ move: greedyMove(V, b), p: 1 }];
}
function greedyMove(V: (s: Board) => number, b: Board): number {
  let best = -1;
  let bestV = -Infinity;
  for (const i of moves(b)) {
    const v = V(play(b, i, "X"));
    if (v > bestV + 1e-12) (best = i), (bestV = v);
  }
  return best;
}

// ---------- Minimax (§1.5: "not correct here") ----------
/** Game-theoretic value for X (1 win, 0 draw, −1 loss) with both sides playing perfectly. */
export function minimaxValues(): Map<Board, number> {
  const memo = new Map<Board, number>();
  const go = (b: Board): number => {
    const hit = memo.get(b);
    if (hit !== undefined) return hit;
    const w = winner(b);
    let v: number;
    if (w) v = w === "X" ? 1 : -1;
    else if (isFull(b)) v = 0;
    else {
      const m = toMove(b);
      const vals = moves(b).map((i) => go(play(b, i, m)));
      v = m === "X" ? Math.max(...vals) : Math.min(...vals);
    }
    memo.set(b, v);
    return v;
  };
  go(EMPTY);
  return memo;
}
/**
 * A minimax player that, among its minimax-best moves, picks the one with the highest true chance of winning
 * against `kind`: the best a player can do while never moving to a position from which it could lose.
 */
export function bestMinimaxSafePolicy(kind: OpponentKind): XPolicy {
  const M = minimaxValues();
  const memo = new Map<Board, number>(); // win probability, restricted to minimax-best moves
  const safeMoves = (b: Board) => {
    const ms = moves(b);
    const best = Math.max(...ms.map((i) => M.get(play(b, i, "X"))!));
    return ms.filter((i) => M.get(play(b, i, "X")) === best);
  };
  const W = (s: Board): number => {
    if (isTerminal(s)) return terminalValue(s);
    const hit = memo.get(s);
    if (hit !== undefined) return hit;
    let v = 0;
    for (const { move, p } of opponentMoves(kind, s)) {
      const t = play(s, move, "O");
      v += p * (isTerminal(t) ? terminalValue(t) : Math.max(...safeMoves(t).map((i) => W(play(t, i, "X")))));
    }
    memo.set(s, v);
    return v;
  };
  return (b) => {
    const ms = safeMoves(b);
    let best = ms[0];
    for (const i of ms) if (W(play(b, i, "X")) > W(play(b, best, "X")) + 1e-12) best = i;
    return [{ move: best, p: 1 }];
  };
}

// ---------- The learner of §1.5 ----------
export interface TttLearner {
  V: Map<Board, number>; // afterstate (or its canonical form) → estimated probability of winning
  n: Map<Board, number>; // updates per entry, for the 1/n step size
}
export interface TttSettings {
  epsilon: number; // probability of an exploratory move
  alpha: number | "1/n"; // constant step size, or 1/n per position
  learnFromExploration?: boolean; // Exercise 1.4: also back up after exploratory moves
  symmetries?: boolean; // Exercise 1.2: one value per symmetry class
}
export const newLearner = (): TttLearner => ({ V: new Map(), n: new Map() });
const key = (s: Board, cfg: TttSettings) => (cfg.symmetries ? canonical(s) : s);
/** The learner's current value of an afterstate (1, 0 at the end of a game; 0.5 before it has been changed). */
export function learnerValue(L: TttLearner, s: Board, cfg: TttSettings = { epsilon: 0, alpha: 0.1 }): number {
  if (isTerminal(s)) return terminalValue(s);
  return L.V.get(key(s, cfg)) ?? 0.5;
}
function backup(L: TttLearner, s: Board, target: number, cfg: TttSettings) {
  const k = key(s, cfg);
  const n = (L.n.get(k) ?? 0) + 1;
  L.n.set(k, n);
  const a = cfg.alpha === "1/n" ? 1 / n : cfg.alpha;
  const v = L.V.get(k) ?? 0.5;
  L.V.set(k, v + a * (target - v));
}
/** Choose our move: greedy, or with probability ε a random one of the other moves. */
export function chooseMove(L: TttLearner, b: Board, cfg: TttSettings, rng: Rng): { move: number; greedy: boolean } {
  const g = greedyMove((s) => learnerValue(L, s, cfg), b);
  const others = moves(b).filter((i) => i !== g);
  if (others.length && rng() < cfg.epsilon) return { move: others[Math.floor(rng() * others.length)], greedy: false };
  return { move: g, greedy: true };
}

export interface TttGame {
  result: "win" | "draw" | "loss";
  positions: Board[]; // every position of the game, from the empty board
  exploratory: number[]; // indices into positions of the positions reached by our exploratory moves
  updates: number;
}
/** Play one game against `kind`, learning as §1.5 describes. */
export function playLearningGame(L: TttLearner, kind: OpponentKind, cfg: TttSettings, rng: Rng): TttGame {
  let b = EMPTY;
  const positions = [b];
  const exploratory: number[] = [];
  let prev: Board | null = null; // our previous afterstate
  let updates = 0;
  for (;;) {
    const { move, greedy } = chooseMove(L, b, cfg, rng);
    const next = play(b, move, "X");
    positions.push(next);
    if (!greedy) exploratory.push(positions.length - 1);
    if (prev !== null && (greedy || cfg.learnFromExploration)) (backup(L, prev, learnerValue(L, next, cfg), cfg), updates++);
    b = next;
    if (isTerminal(b)) break;
    prev = b;
    b = play(b, sample(opponentMoves(kind, b), rng), "O");
    positions.push(b);
    if (isTerminal(b)) {
      backup(L, prev, terminalValue(b), cfg); // the opponent ended the game: the final position is the later state
      updates++;
      break;
    }
  }
  const w = winner(b);
  return { result: w === "X" ? "win" : w === "O" ? "loss" : "draw", positions, exploratory, updates };
}

/** Train for `games` games; returns the fraction of wins in each block of `block` games. */
export function trainTicTacToe(L: TttLearner, kind: OpponentKind, cfg: TttSettings, games: number, rng: Rng, block = 100): number[] {
  const out: number[] = [];
  let wins = 0;
  for (let g = 1; g <= games; g++) {
    if (playLearningGame(L, kind, cfg, rng).result === "win") wins++;
    if (g % block === 0) (out.push(wins / block), (wins = 0));
  }
  return out;
}

/** The learner's greedy policy, evaluated exactly against `kind`. */
export function learnedPolicyResult(L: TttLearner, kind: OpponentKind, cfg: TttSettings) {
  return evaluatePolicy(greedyPolicy((s) => learnerValue(L, s, cfg)), kind);
}

// ---------- Self-play (Exercise 1.1) ----------
/**
 * Two learners, one for each side, each valuing the positions after its own moves (for O, a win for O is 1);
 * returns the result of each game for X.
 */
export function selfPlay(X: TttLearner, O: TttLearner, cfg: TttSettings, games: number, rng: Rng): ("win" | "draw" | "loss")[] {
  const flip = (b: Board) => [...b].map((c) => (c === "X" ? "O" : c === "O" ? "X" : c)).join(""); // O's view: its marks as X
  const results: ("win" | "draw" | "loss")[] = [];
  for (let g = 0; g < games; g++) {
    let b = EMPTY;
    const prev: Record<Mark, Board | null> = { X: null, O: null };
    for (;;) {
      const m = toMove(b);
      const L = m === "X" ? X : O;
      const view = m === "X" ? b : flip(b); // each learner sees itself as X
      const { move, greedy } = chooseMove(L, view, cfg, rng);
      const nextView = play(view, move, "X");
      const p = prev[m];
      if (p !== null && (greedy || cfg.learnFromExploration)) backup(L, p, learnerValue(L, nextView, cfg), cfg);
      b = play(b, move, m);
      if (isTerminal(b)) {
        const other: Mark = m === "X" ? "O" : "X";
        const po = prev[other];
        const otherView = other === "X" ? b : flip(b);
        if (po !== null) backup(other === "X" ? X : O, po, terminalValue(otherView), cfg); // the loser (or drawer) learns the outcome
        break;
      }
      prev[m] = nextView;
    }
    const w = winner(b);
    results.push(w === "X" ? "win" : w === "O" ? "loss" : "draw");
  }
  return results;
}
/** The worst case for a fixed greedy X policy: the result against an opponent that knows it and plays perfectly. */
export function worstCaseAgainstPerfect(policy: XPolicy): "win" | "draw" | "loss" {
  const go = (b: Board): number => {
    const w = winner(b);
    if (w) return w === "X" ? 1 : -1;
    if (isFull(b)) return 0;
    if (toMove(b) === "X") return go(play(b, policy(b)[0].move, "X"));
    return Math.min(...moves(b).map((i) => go(play(b, i, "O"))));
  };
  const v = go(EMPTY);
  return v > 0 ? "win" : v < 0 ? "loss" : "draw";
}

// ---------- Exercise 1.4: the two sets of probabilities ----------
/** The ε-greedy version of a deterministic policy: its move with probability 1 − ε, otherwise one of the other moves. */
export function epsilonGreedyOf(policy: XPolicy, epsilon: number): XPolicy {
  return (b) => {
    const g = policy(b)[0].move;
    const others = moves(b).filter((i) => i !== g);
    return others.length ? [{ move: g, p: 1 - epsilon }, ...others.map((move) => ({ move, p: epsilon / others.length }))] : [{ move: g, p: 1 }];
  };
}
/** The true probability of winning from each afterstate when we follow `policy` against `kind`. */
export function afterstateValuesUnder(policy: XPolicy, kind: OpponentKind): (s: Board) => number {
  const memo = new Map<Board, number>();
  const go = (s: Board): number => {
    if (isTerminal(s)) return terminalValue(s);
    const hit = memo.get(s);
    if (hit !== undefined) return hit;
    let v = 0;
    for (const { move, p } of opponentMoves(kind, s)) {
      const t = play(s, move, "O");
      v += p * (isTerminal(t) ? terminalValue(t) : policy(t).reduce((a, d) => a + d.p * go(play(t, d.move, "X")), 0));
    }
    memo.set(s, v);
    return v;
  };
  return go;
}
