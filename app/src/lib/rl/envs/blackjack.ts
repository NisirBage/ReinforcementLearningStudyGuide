// Blackjack, Example 5.1 of the April 2015 draft (pp. 115–116), as a finite MDP with exact dynamics.
//
// The draft's rules: an infinite deck (cards drawn with replacement; 2–9 at face value, face cards 10, an ace 1 or
// 11); the player's two-card 21 is a natural, which wins unless the dealer also has one (a draw); otherwise the
// player hits until he sticks or goes bust; the dealer then hits below 17 and sticks on 17 or more; a dealer bust
// wins for the player, otherwise the closer sum to 21 wins. Rewards +1, 0, −1 at the end; γ = 1.
//
// State (p. 116): the player's sum 12–21, the dealer's showing card (ace–10) and whether the player holds a usable
// ace: 200 states. Below 12 there is no decision (hitting cannot bust), so the deal hits automatically up to 12.
// Because the deck is infinite, every transition probability can be computed exactly: hitting draws one card;
// sticking resolves to the dealer's final-sum distribution given the showing card. So the same model serves
// Monte Carlo (which only samples it) and dynamic programming (which solves it exactly, as an independent check).
//
// Index layout: 0 = "deal" (the start of a game; its only action deals the cards), 1–200 = player states, 201 = end.
import type { FiniteMDP, Policy, Transition } from "../mdp";

export const STICK = 0;
export const HIT = 1;
export const DEAL = 2;
export const DEAL_STATE = 0;
export const END = 201;

/** Probability of each card value 1 (ace) to 10 (10, J, Q, K). */
export const CARD_P = [0, ...Array.from({ length: 9 }, () => 1 / 13), 4 / 13];

export interface BjState {
  sum: number; // 12–21
  dealer: number; // showing card, 1 (ace) to 10
  usable: boolean;
}

export const bjIndex = (sum: number, dealer: number, usable: boolean) => 1 + (usable ? 100 : 0) + (sum - 12) * 10 + (dealer - 1);
export function bjState(i: number): BjState {
  const k = i - 1;
  return { usable: k >= 100, sum: 12 + Math.floor((k % 100) / 10), dealer: (k % 10) + 1 };
}
export const bjName = (i: number) => (i === DEAL_STATE ? "deal" : i === END ? "end" : (({ sum, dealer, usable }) => `${sum}, dealer ${dealer === 1 ? "A" : dealer}${usable ? ", usable ace" : ""}`)(bjState(i)));

/** Adds a card to a hand (sum, usable ace), counting an ace as 11 when that does not bust. */
export function addCard(sum: number, usable: boolean, card: number): { sum: number; usable: boolean } {
  let s = sum + card;
  let u = usable;
  if (card === 1 && s + 10 <= 21) {
    s += 10;
    u = true;
  }
  if (s > 21 && u) {
    s -= 10;
    u = false;
  }
  return { sum: s, usable: u };
}

/**
 * Distribution of the dealer's final sum given the showing card: the hidden card is drawn, then the dealer hits
 * while below 17 and sticks on 17 or more (a soft 17 counts as 17). Keys 17–21, and 22 for bust.
 */
export function dealerFinal(showing: number): Map<number, number> {
  const out = new Map<number, number>();
  const memo = new Map<string, Map<number, number>>();
  const play = (sum: number, usable: boolean): Map<number, number> => {
    const key = `${sum},${usable}`;
    const hit = memo.get(key);
    if (hit) return hit;
    const res = new Map<number, number>();
    if (sum > 21) res.set(22, 1);
    else if (sum >= 17) res.set(sum, 1);
    else
      for (let c = 1; c <= 10; c++) {
        const n = addCard(sum, usable, c);
        for (const [k, p] of play(n.sum, n.usable)) res.set(k, (res.get(k) ?? 0) + CARD_P[c] * p);
      }
    memo.set(key, res);
    return res;
  };
  const first = addCard(0, false, showing);
  for (let c = 1; c <= 10; c++) {
    const n = addCard(first.sum, first.usable, c);
    for (const [k, p] of play(n.sum, n.usable)) out.set(k, (out.get(k) ?? 0) + CARD_P[c] * p);
  }
  return out;
}

/** Probability that the dealer's two cards are a natural, given the showing card. */
export const dealerNatural = (showing: number) => (showing === 1 ? CARD_P[10] : showing === 10 ? CARD_P[1] : 0);

/** Outcome of sticking on `sum` against the dealer's final distribution: P(+1), P(0), P(−1). */
function stickOutcome(sum: number, dealer: Map<number, number>) {
  let win = 0, draw = 0, lose = 0;
  for (const [d, p] of dealer) {
    if (d === 22 || sum > d) win += p;
    else if (sum === d) draw += p;
    else lose += p;
  }
  return { win, draw, lose };
}

/** The game as a finite MDP (see the header). Actions: stick, hit, deal. */
export function blackjack(): FiniteMDP {
  const n = 202;
  const states = Array.from({ length: n }, (_, i) => bjName(i));
  const terminal = states.map((_, i) => i === END);
  const finals = Array.from({ length: 11 }, (_, d) => (d >= 1 ? dealerFinal(d) : new Map<number, number>()));
  const dynamics: Transition[][][] = states.map(() => [[], [], []]);

  // Player states: stick resolves the game; hit draws a card.
  for (let i = 1; i <= 200; i++) {
    const { sum, dealer, usable } = bjState(i);
    const o = stickOutcome(sum, finals[dealer]);
    dynamics[i][STICK] = [
      { next: END, reward: 1, prob: o.win },
      { next: END, reward: 0, prob: o.draw },
      { next: END, reward: -1, prob: o.lose },
    ].filter((t) => t.prob > 0);
    const hit = new Map<string, Transition>();
    for (let c = 1; c <= 10; c++) {
      const h = addCard(sum, usable, c);
      const next = h.sum > 21 ? END : bjIndex(h.sum, dealer, h.usable);
      const reward = h.sum > 21 ? -1 : 0;
      const key = `${next},${reward}`;
      const t = hit.get(key);
      hit.set(key, t ? { ...t, prob: t.prob + CARD_P[c] } : { next, reward, prob: CARD_P[c] });
    }
    dynamics[i][HIT] = [...hit.values()];
  }

  // The deal: dealer's showing card, the player's two cards, a natural, and the automatic hits below 12.
  const deal = new Map<string, Transition>();
  const add = (next: number, reward: number, prob: number) => {
    const key = `${next},${reward}`;
    const t = deal.get(key);
    deal.set(key, t ? { ...t, prob: t.prob + prob } : { next, reward, prob });
  };
  const autoHit = (sum: number, usable: boolean, dealer: number, prob: number) => {
    if (sum >= 12) return add(bjIndex(sum, dealer, usable), 0, prob);
    for (let c = 1; c <= 10; c++) {
      const h = addCard(sum, usable, c);
      autoHit(h.sum, h.usable, dealer, prob * CARD_P[c]);
    }
  };
  for (let d = 1; d <= 10; d++)
    for (let a = 1; a <= 10; a++)
      for (let b = 1; b <= 10; b++) {
        const p = CARD_P[d] * CARD_P[a] * CARD_P[b];
        const h = addCard(addCard(0, false, a).sum, addCard(0, false, a).usable, b);
        if (h.sum === 21) {
          // A natural: a draw against a dealer natural, otherwise a win.
          const dn = dealerNatural(d);
          add(END, 0, p * dn);
          add(END, 1, p * (1 - dn));
        } else autoHit(h.sum, h.usable, d, p);
      }
  dynamics[DEAL_STATE][DEAL] = [...deal.values()].filter((t) => t.prob > 0);
  return { states, terminal, actions: ["stick", "hit", "deal"], dynamics };
}

/** A deterministic player policy (stick or hit in each of the 200 states) as a Policy; the deal state deals. */
export function bjPolicy(choose: (s: BjState) => typeof STICK | typeof HIT): Policy {
  return Array.from({ length: 202 }, (_, i) => (i === DEAL_STATE ? [0, 0, 1] : i === END ? [0, 0, 0] : choose(bjState(i)) === STICK ? [1, 0, 0] : [0, 1, 0]));
}

/** The policy of Example 5.1: stick only on 20 or 21. */
export const stickOn20 = () => bjPolicy((s) => (s.sum >= 20 ? STICK : HIT));

/** The 400 exploring-start pairs of Example 5.3: every player state, both actions, each equally likely. */
export const bjStartPairs = (): [number, number][] => Array.from({ length: 200 }, (_, k) => k + 1).flatMap((s) => [[s, STICK], [s, HIT]] as [number, number][]);
