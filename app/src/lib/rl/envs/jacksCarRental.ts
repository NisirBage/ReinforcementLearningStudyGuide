// Jack's car rental, Example 4.2 (Sutton & Barto, April 2015 draft, printed p. 98, Figure 4.4), and the variant of
// Exercise 4.5 (printed p. 110). The draft's description fixes:
//   - two locations, at most 20 cars each (extra cars go back to the national company);
//   - rental requests and returns are Poisson: λ = 3 and 4 for requests, 3 and 2 for returns;
//   - $10 per car rented; $2 per car moved overnight; at most 5 cars moved; γ = 0.9; a continuing task;
//   - the state is the number of cars at each location at the end of the day; the action is the net number of cars
//     moved from the first location to the second overnight (negative: from the second to the first);
//   - returned cars become available the day after they are returned.
// So one day runs: move cars overnight (capped at 20), rent from the cars available (lost business if none), then
// the returns arrive and are counted in the next state (capped at 20). This ordering is our reading of the text.
//
// The dynamics factor into two independent locations, so v is evaluated with per-location tables instead of a
// generic FiniteMDP (whose 441 states × 11 actions × 441 next states would need millions of transition objects).
// The rewards enter only through their expectation r(s, a), which gives the same values (the Bellman equation (3.12)
// uses only expected rewards). Probabilities are exact: the Poisson tails are folded into "all cars rented" and
// "lot full" rather than truncated.

export interface JackParams {
  maxCars: number; // 20
  maxMove: number; // 5
  rentReward: number; // 10
  moveCost: number; // 2 per car
  lambdaRequest: [number, number]; // [3, 4]
  lambdaReturn: [number, number]; // [3, 2]
  gamma: number; // 0.9
  freeShuttle: boolean; // Exercise 4.5: one car moved from the first location to the second is free
  parkingLimit: number | null; // Exercise 4.5: more than this many cars kept overnight at a location…
  parkingCost: number; // …costs this much (per location, independent of how many)
}

export const JACK_EXAMPLE: JackParams = {
  maxCars: 20, maxMove: 5, rentReward: 10, moveCost: 2, lambdaRequest: [3, 4], lambdaReturn: [3, 2], gamma: 0.9,
  freeShuttle: false, parkingLimit: null, parkingCost: 0,
};
/** Exercise 4.5: one free shuttle from the first location to the second, and $4 for more than 10 cars at a location. */
export const JACK_EXERCISE_4_5: JackParams = { ...JACK_EXAMPLE, freeShuttle: true, parkingLimit: 10, parkingCost: 4 };

/** Poisson probabilities P(N = 0..k−1) and P(N ≥ k) folded into the last entry. */
export function poissonFolded(lambda: number, k: number): number[] {
  const p: number[] = [];
  let term = Math.exp(-lambda);
  let total = 0;
  for (let n = 0; n < k; n++) {
    p.push(term);
    total += term;
    term = (term * lambda) / (n + 1);
  }
  p.push(Math.max(0, 1 - total));
  return p;
}

/** For one location with m cars available in the morning: the expected rentals and the distribution of cars at night. */
export interface LocationTable {
  rented: number[]; // rented[m] = E[min(requests, m)]
  next: number[][]; // next[m][n] = P(n cars at the end of the day | m in the morning)
}

export function locationTable(lambdaReq: number, lambdaRet: number, maxCars: number): LocationTable {
  const rented: number[] = [];
  const next: number[][] = [];
  for (let m = 0; m <= maxCars; m++) {
    const req = poissonFolded(lambdaReq, m); // req[k] = P(k rented) for k < m, P(≥ m requests) at k = m
    rented.push(req.reduce((s, p, k) => s + p * k, 0));
    const row = new Array(maxCars + 1).fill(0);
    req.forEach((pk, k) => {
      const left = m - k;
      const ret = poissonFolded(lambdaRet, maxCars - left); // returns beyond the cap fill the lot
      ret.forEach((pr, r) => (row[left + r] += pk * pr));
    });
    next.push(row);
  }
  return { rented, next };
}

export interface JackModel {
  params: JackParams;
  n: number; // cars per location + 1
  actions: number[]; // −maxMove … maxMove
  loc: [LocationTable, LocationTable];
}

export function jackModel(params: JackParams = JACK_EXAMPLE): JackModel {
  const actions = Array.from({ length: 2 * params.maxMove + 1 }, (_, i) => i - params.maxMove);
  return {
    params,
    n: params.maxCars + 1,
    actions,
    loc: [locationTable(params.lambdaRequest[0], params.lambdaReturn[0], params.maxCars), locationTable(params.lambdaRequest[1], params.lambdaReturn[1], params.maxCars)],
  };
}

export const stateIndex = (m: JackModel, cars1: number, cars2: number) => cars1 * m.n + cars2;

/** Can `a` cars (net, first → second) be moved from state (cars1, cars2)? */
export const feasible = (cars1: number, cars2: number, a: number) => (a >= 0 ? a <= cars1 : -a <= cars2);

/** The cost of moving `a` cars overnight and parking the result (Exercise 4.5 options included). */
export function overnightCost(p: JackParams, after1: number, after2: number, a: number): number {
  const paid = a > 0 && p.freeShuttle ? a - 1 : Math.abs(a);
  let cost = p.moveCost * paid;
  if (p.parkingLimit !== null) cost += (after1 > p.parkingLimit ? p.parkingCost : 0) + (after2 > p.parkingLimit ? p.parkingCost : 0);
  return cost;
}

/** q(s, a) = r(s, a) + γ Σ_{s′} p(s′|s, a) v(s′), for state (cars1, cars2) and a feasible action a. */
export function jackActionValue(m: JackModel, v: ArrayLike<number>, cars1: number, cars2: number, a: number): number {
  const p = m.params;
  const after1 = Math.min(cars1 - a, p.maxCars);
  const after2 = Math.min(cars2 + a, p.maxCars);
  const [l1, l2] = m.loc;
  const reward = p.rentReward * (l1.rented[after1] + l2.rented[after2]) - overnightCost(p, after1, after2, a);
  const n1 = l1.next[after1];
  const n2 = l2.next[after2];
  let future = 0;
  for (let i = 0; i < m.n; i++) {
    if (n1[i] === 0) continue;
    let row = 0;
    for (let j = 0; j < m.n; j++) row += n2[j] * v[i * m.n + j];
    future += n1[i] * row;
  }
  return reward + p.gamma * future;
}

/** In-place iterative policy evaluation (Figure 4.1) of a deterministic policy, from `v0`, until Δ < θ. */
export function jackEvaluate(m: JackModel, policy: ArrayLike<number>, v0: ArrayLike<number>, theta = 1e-6, maxSweeps = 10_000): { v: Float64Array; sweeps: number } {
  const v = Float64Array.from(v0);
  for (let sweep = 1; sweep <= maxSweeps; sweep++) {
    let delta = 0;
    for (let c1 = 0; c1 < m.n; c1++)
      for (let c2 = 0; c2 < m.n; c2++) {
        const s = c1 * m.n + c2;
        const x = jackActionValue(m, v, c1, c2, policy[s]);
        delta = Math.max(delta, Math.abs(x - v[s]));
        v[s] = x;
      }
    if (delta < theta) return { v, sweeps: sweep };
  }
  return { v, sweeps: maxSweeps };
}

/** Greedy improvement (4.9), keeping the current action when it ties for best (the fix for Figure 4.3's bug). */
export function jackImprove(m: JackModel, v: ArrayLike<number>, current: ArrayLike<number>, tol = 1e-9): { policy: Int8Array; changed: number } {
  const policy = new Int8Array(m.n * m.n);
  let changed = 0;
  for (let c1 = 0; c1 < m.n; c1++)
    for (let c2 = 0; c2 < m.n; c2++) {
      const s = c1 * m.n + c2;
      let best = current[s];
      let bestQ = jackActionValue(m, v, c1, c2, best);
      for (const a of m.actions) {
        if (!feasible(c1, c2, a) || a === current[s]) continue;
        const q = jackActionValue(m, v, c1, c2, a);
        if (q > bestQ + tol) (best = a), (bestQ = q);
      }
      policy[s] = best;
      if (best !== current[s]) changed++;
    }
  return { policy, changed };
}

export interface JackIteration {
  policy: Int8Array; // π_k, as net cars moved from the first location to the second
  v: Float64Array; // v_{π_k}
  sweeps: number;
  changed: number; // states whose action changed in the improvement that produced π_k (0 for π_0)
}

/** Policy iteration (Figure 4.3) from the policy that never moves a car, as in Figure 4.4. */
export function jackPolicyIteration(params: JackParams = JACK_EXAMPLE, opts: { theta?: number; maxIterations?: number } = {}): { iterations: JackIteration[]; stable: boolean; model: JackModel } {
  const m = jackModel(params);
  const theta = opts.theta ?? 1e-6;
  let policy: Int8Array = new Int8Array(m.n * m.n);
  let v: ArrayLike<number> = new Float64Array(m.n * m.n);
  const iterations: JackIteration[] = [];
  let changed = 0;
  for (let k = 0; k < (opts.maxIterations ?? 20); k++) {
    const ev = jackEvaluate(m, policy, v, theta);
    v = ev.v;
    iterations.push({ policy, v: ev.v, sweeps: ev.sweeps, changed });
    const imp = jackImprove(m, v, policy);
    if (imp.changed === 0) return { iterations, stable: true, model: m };
    policy = imp.policy;
    changed = imp.changed;
  }
  return { iterations, stable: false, model: m };
}
