// The recycling robot MDP of Example 3.7 (Sutton & Barto, April 2015 draft, Table 3.1, printed p. 69).
// States high and low; A(high) = {search, wait}, A(low) = {search, wait, recharge}. The draft leaves α, β, r_search
// and r_wait symbolic (with r_search > r_wait); any numbers used are the learner's or the app's choice, not the book's.
// Table 3.1 gives expected rewards r(s, a, s′); each is used here as a deterministic reward, which gives the same
// values v_π because only expected rewards enter the Bellman equation (3.12).
import type { FiniteMDP } from "../mdp";

export interface RecyclingParams {
  alpha: number; // P(high stays high | search)
  beta: number; // P(low stays low | search)
  rSearch: number;
  rWait: number;
}

export const RECYCLING_ACTIONS = ["search", "wait", "recharge"] as const;

/** Rows of Table 3.1 in order, including its zero-probability rows; recharge is unavailable in high. */
export function recyclingRobot(p: RecyclingParams): FiniteMDP {
  const HIGH = 0;
  const LOW = 1;
  const o = (next: number, prob: number, reward: number) => ({ next, prob, reward });
  return {
    states: ["high", "low"],
    terminal: [false, false],
    actions: [...RECYCLING_ACTIONS],
    dynamics: [
      [
        [o(HIGH, p.alpha, p.rSearch), o(LOW, 1 - p.alpha, p.rSearch)], // search
        [o(HIGH, 1, p.rWait), o(LOW, 0, p.rWait)], // wait
        [], // recharge: not in A(high)
      ],
      [
        [o(HIGH, 1 - p.beta, -3), o(LOW, p.beta, p.rSearch)], // search: depleted → rescued, −3, back to high
        [o(HIGH, 0, p.rWait), o(LOW, 1, p.rWait)], // wait
        [o(HIGH, 1, 0), o(LOW, 0, 0)], // recharge
      ],
    ],
  };
}

/** Uniform over the available actions of each state. */
export const recyclingRandomPolicy = (): number[][] => [
  [0.5, 0.5, 0],
  [1 / 3, 1 / 3, 1 / 3],
];
