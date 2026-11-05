// Returns, Sutton & Barto (April 2015 draft) §3.3: G_t = R_{t+1} + γR_{t+2} + γ²R_{t+3} + … (3.2).

/** G_0 for the reward sequence R_1, R_2, …, R_T (rewards[0] is R_1). Rewards after the list are 0 (episode over). */
export function discountedReturn(rewards: readonly number[], gamma: number): number {
  if (gamma < 0 || gamma > 1) throw new RangeError("γ must lie in [0, 1]");
  // Backwards (Horner) form G_t = R_{t+1} + γ G_{t+1}: exact for γ = 0, where 0^0 = 1 is not needed.
  return rewards.reduceRight((g, r) => r + gamma * g, 0);
}

/** [G_0, G_1, …, G_T] for one episode, with G_T = 0, by the recursion G_t = R_{t+1} + γ G_{t+1}. */
export function returnsOfEpisode(rewards: readonly number[], gamma: number): number[] {
  if (gamma < 0 || gamma > 1) throw new RangeError("γ must lie in [0, 1]");
  const g = new Array<number>(rewards.length + 1).fill(0);
  for (let t = rewards.length - 1; t >= 0; t--) g[t] = rewards[t] + gamma * g[t + 1];
  return g;
}

/** Return of a constant reward c received forever: c / (1 − γ) for γ < 1 (geometric series). */
export function constantRewardReturn(c: number, gamma: number): number {
  if (!(gamma >= 0 && gamma < 1)) throw new RangeError("needs 0 ≤ γ < 1: with γ = 1 the return is infinite");
  return c / (1 - gamma);
}
