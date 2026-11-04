// Stochastic approximation. SUPPLEMENTARY: Zhao, Mathematical Foundations of RL, Chapter 6 (not in the April 2015 draft).

/**
 * Robbins–Monro iteration (Zhao eq. 6.5): w_{k+1} = w_k − a_k g̃(w_k, η_k), k = 1, 2, …
 * `observe(w, k)` returns the noisy observation g̃(w_k, η_k). Returns [w_1, …, w_{K+1}].
 */
export function robbinsMonro(observe: (w: number, k: number) => number, w1: number, a: (k: number) => number, K: number): number[] {
  const ws = [w1];
  for (let k = 1; k <= K; k++) ws.push(ws[k - 1] - a(k) * observe(ws[k - 1], k));
  return ws;
}
