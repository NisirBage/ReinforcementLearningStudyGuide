// An editable finite MDP for the MDP Explorer and the Bellman laboratory: what the learner types, how it is checked,
// and how it becomes the FiniteMDP + policy that lib/rl computes with. Pure.
import { equiprobablePolicy, type FiniteMDP, type Policy } from "../lib/rl/mdp";
import { gridworld4x4 } from "../lib/rl/envs/gridworld4x4";
import { recyclingRandomPolicy, recyclingRobot, type RecyclingParams } from "../lib/rl/envs/recycling";

export interface OutcomeSpec {
  next: number; // state index
  reward: number;
  prob: number;
}

export interface MdpSpec {
  states: { name: string; terminal: boolean }[];
  actions: string[];
  /** outcomes[s][a]: the (s′, r) pairs of p(s′, r | s, a). An empty list means a is not available in s. */
  outcomes: OutcomeSpec[][][];
  policy: number[][]; // π(a | s)
  gamma: number;
}

export const MAX_STATES = 16;
export const MAX_ACTIONS = 4;
export const TOL = 1e-6; // sums are accepted within this tolerance (typed decimals such as 1/3)

export interface SpecProblem {
  where: string;
  message: string;
}

export const available = (spec: MdpSpec, s: number, a: number) => (spec.outcomes[s]?.[a]?.length ?? 0) > 0;

/** Every problem that would make p(·|s,a) or π(·|s) not a probability distribution, or the MDP ill-formed. */
export function checkSpec(spec: MdpSpec): SpecProblem[] {
  const out: SpecProblem[] = [];
  const n = spec.states.length;
  if (n === 0) out.push({ where: "states", message: "Add at least one state." });
  if (n > MAX_STATES) out.push({ where: "states", message: `At most ${MAX_STATES} states.` });
  if (spec.actions.length === 0) out.push({ where: "actions", message: "Add at least one action." });
  if (spec.actions.length > MAX_ACTIONS) out.push({ where: "actions", message: `At most ${MAX_ACTIONS} actions.` });
  const names = spec.states.map((s) => s.name.trim());
  if (names.some((x) => !x)) out.push({ where: "states", message: "Every state needs a name." });
  if (new Set(names).size !== names.length) out.push({ where: "states", message: "State names must be different." });
  const an = spec.actions.map((a) => a.trim());
  if (an.some((x) => !x) || new Set(an).size !== an.length) out.push({ where: "actions", message: "Actions need different, non-empty names." });
  if (!(spec.gamma >= 0 && spec.gamma <= 1)) out.push({ where: "γ", message: "The discount rate γ must lie in [0, 1]." });
  spec.states.forEach((st, s) => {
    if (st.terminal) return;
    const label = st.name || `state ${s + 1}`;
    if (!spec.actions.some((_, a) => available(spec, s, a))) out.push({ where: label, message: `${label} is not terminal but has no available action.` });
    spec.actions.forEach((act, a) => {
      const list = spec.outcomes[s]?.[a] ?? [];
      if (!list.length) return;
      const where = `p(·, · | ${label}, ${act})`;
      list.forEach((o, i) => {
        if (!Number.isInteger(o.next) || o.next < 0 || o.next >= n) out.push({ where, message: `outcome ${i + 1} goes to a state that does not exist.` });
        if (!Number.isFinite(o.reward)) out.push({ where, message: `outcome ${i + 1} needs a numeric reward.` });
        if (!(Number.isFinite(o.prob) && o.prob >= 0 && o.prob <= 1)) out.push({ where, message: `outcome ${i + 1} has probability ${o.prob}; probabilities lie in [0, 1].` });
      });
      const sum = list.reduce((t, o) => t + (Number.isFinite(o.prob) ? o.prob : 0), 0);
      if (Math.abs(sum - 1) > TOL) out.push({ where, message: `the probabilities sum to ${round(sum)}, not 1.` });
    });
    const row = spec.policy[s] ?? [];
    const where = `π(· | ${label})`;
    spec.actions.forEach((act, a) => {
      const x = row[a] ?? 0;
      if (!(Number.isFinite(x) && x >= 0 && x <= 1)) out.push({ where, message: `π(${act} | ${label}) = ${x}; probabilities lie in [0, 1].` });
      else if (x > 0 && !available(spec, s, a)) out.push({ where, message: `${act} is not available in ${label}, so π(${act} | ${label}) must be 0.` });
    });
    const sum = spec.actions.reduce((t, _, a) => t + (Number.isFinite(row[a]) ? row[a] : 0), 0);
    if (Math.abs(sum - 1) > TOL) out.push({ where, message: `the policy's probabilities sum to ${round(sum)}, not 1.` });
  });
  return out;
}

const round = (x: number) => Math.round(x * 1e6) / 1e6;

/** The FiniteMDP and policy for a valid spec (call checkSpec first). Terminal states keep no dynamics. */
export function toMdp(spec: MdpSpec): { mdp: FiniteMDP; pi: Policy } {
  const mdp: FiniteMDP = {
    states: spec.states.map((s) => s.name.trim()),
    terminal: spec.states.map((s) => s.terminal),
    actions: spec.actions.map((a) => a.trim()),
    dynamics: spec.states.map((st, s) => spec.actions.map((_, a) => (st.terminal ? [] : (spec.outcomes[s]?.[a] ?? []).map((o) => ({ ...o }))))),
  };
  const pi = spec.states.map((st, s) => spec.actions.map((_, a) => (st.terminal ? 0 : spec.policy[s]?.[a] ?? 0)));
  return { mdp, pi };
}

export function fromMdp(mdp: FiniteMDP, pi: Policy, gamma: number): MdpSpec {
  return {
    states: mdp.states.map((name, s) => ({ name, terminal: mdp.terminal[s] })),
    actions: [...mdp.actions],
    outcomes: mdp.dynamics.map((row) => row.map((outs) => outs.map((o) => ({ ...o })))),
    policy: pi.map((r) => [...r]),
    gamma,
  };
}

/** Uniform over the actions available in each nonterminal state. */
export function uniformPolicy(spec: MdpSpec): number[][] {
  return spec.states.map((st, s) => {
    const av = spec.actions.map((_, a) => !st.terminal && available(spec, s, a));
    const k = av.filter(Boolean).length;
    return av.map((x) => (x && k ? 1 / k : 0));
  });
}

// ---------- Presets ----------

/** The app's sample numbers for Example 3.7; the draft leaves α, β, r_search, r_wait symbolic (r_search > r_wait). */
export const RECYCLING_DEFAULTS: RecyclingParams = { alpha: 0.9, beta: 0.6, rSearch: 2, rWait: 1 };

export const recyclingSpec = (p: RecyclingParams = RECYCLING_DEFAULTS, gamma = 0.9): MdpSpec => fromMdp(recyclingRobot(p), recyclingRandomPolicy(), gamma);

export function gridworldSpec(): MdpSpec {
  const g = gridworld4x4();
  return fromMdp(g, equiprobablePolicy(g), 1);
}

/** A small editable starting point: two states, one terminal. */
export const blankSpec = (): MdpSpec => ({
  states: [{ name: "A", terminal: false }, { name: "T", terminal: true }],
  actions: ["go", "stay"],
  outcomes: [[[{ next: 1, reward: 1, prob: 1 }], [{ next: 0, reward: 0, prob: 1 }]], [[], []]],
  policy: [[0.5, 0.5], [0, 0]],
  gamma: 0.9,
});

// ---------- Edits (each returns a new spec) ----------

export function addState(spec: MdpSpec): MdpSpec {
  const n = spec.states.length;
  let i = n + 1;
  while (spec.states.some((s) => s.name === `S${i}`)) i++;
  return {
    ...spec,
    states: [...spec.states, { name: `S${i}`, terminal: false }],
    outcomes: [...spec.outcomes, spec.actions.map(() => [{ next: n, reward: 0, prob: 1 }])],
    policy: [...spec.policy, spec.actions.map(() => 1 / spec.actions.length)],
  };
}

/** Removes a state; outcomes that led to it are removed too (so their rows may need fixing, and the check says so). */
export function removeState(spec: MdpSpec, s: number): MdpSpec {
  const remap = (o: OutcomeSpec) => (o.next > s ? { ...o, next: o.next - 1 } : o);
  return {
    ...spec,
    states: spec.states.filter((_, i) => i !== s),
    outcomes: spec.outcomes.filter((_, i) => i !== s).map((row) => row.map((outs) => outs.filter((o) => o.next !== s).map(remap))),
    policy: spec.policy.filter((_, i) => i !== s),
  };
}

export function addAction(spec: MdpSpec): MdpSpec {
  let i = spec.actions.length + 1;
  while (spec.actions.includes(`a${i}`)) i++;
  return { ...spec, actions: [...spec.actions, `a${i}`], outcomes: spec.outcomes.map((row) => [...row, []]), policy: spec.policy.map((r) => [...r, 0]) };
}

export function removeAction(spec: MdpSpec, a: number): MdpSpec {
  return { ...spec, actions: spec.actions.filter((_, i) => i !== a), outcomes: spec.outcomes.map((row) => row.filter((_, i) => i !== a)), policy: spec.policy.map((r) => r.filter((_, i) => i !== a)) };
}

export function setOutcomes(spec: MdpSpec, s: number, a: number, list: OutcomeSpec[]): MdpSpec {
  return { ...spec, outcomes: spec.outcomes.map((row, i) => (i === s ? row.map((outs, j) => (j === a ? list : outs)) : row)) };
}

export function setPolicy(spec: MdpSpec, s: number, a: number, x: number): MdpSpec {
  return { ...spec, policy: spec.policy.map((r, i) => (i === s ? r.map((y, j) => (j === a ? x : y)) : r)) };
}
