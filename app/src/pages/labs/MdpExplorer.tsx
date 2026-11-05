// MDP explorer: edit a finite MDP's states, actions, dynamics p(s′, r | s, a) and policy; it is checked as you type,
// drawn as a transition graph, and evaluated exactly (solving (4.4)) and by iterative policy evaluation (4.5).
import { useMemo, useState } from "react";
import { expectedReward, solveExact, transitionProb, bellmanResidual } from "../../lib/rl/mdp";
import { iterativePolicyEvaluation } from "../../lib/rl/dp";
import { toCells } from "../../lib/rl/envs/gridworld4x4";
import {
  MAX_ACTIONS, MAX_STATES, RECYCLING_DEFAULTS, addAction, addState, available, blankSpec, checkSpec, gridworldSpec, recyclingSpec, removeAction,
  removeState, setOutcomes, setPolicy, toMdp, uniformPolicy, type MdpSpec,
} from "../../domain/mdpModel";
import type { RecyclingParams } from "../../lib/rl/envs/recycling";
import { Tex } from "../../components/math";
import { NumberInput } from "../../components/NumberInput";

const f = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "–");
const parse = (v: string) => (v.trim() === "" ? NaN : Number(v));
/** Accepts decimals and simple fractions such as 1/3. */
const parseProb = (v: string) => {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(v);
  return m ? Number(m[1]) / Number(m[2]) : parse(v);
};

function NumberCell({ value, onChange, label, prob }: { value: number; onChange: (x: number) => void; label: string; prob?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      className="mini-input"
      aria-label={label}
      inputMode="decimal"
      value={text ?? (Number.isFinite(value) ? String(Math.round(value * 1e6) / 1e6) : "")}
      onChange={(e) => {
        setText(e.target.value);
        onChange(prob ? parseProb(e.target.value) : parse(e.target.value));
      }}
      onBlur={() => setText(null)}
    />
  );
}

/**
 * The dynamics as a layered diagram: each state (left) leads to its available actions (middle), and each action to
 * its possible next states (right), with p(s′, r | s, a) and r on the arrow. Every state appears on both sides, so
 * self-transitions need no loops and nothing overlaps. Outcomes with probability 0 are not drawn.
 */
export function TransitionGraph({ spec }: { spec: MdpSpec }) {
  const rows: { s: number; a: number }[] = [];
  spec.states.forEach((st, s) => {
    if (!st.terminal) spec.actions.forEach((_, a) => available(spec, s, a) && rows.push({ s, a }));
  });
  const ROW = 58;
  const TOP = 34;
  const H = Math.max(rows.length, spec.states.length) * ROW + TOP + 10;
  const W = 560;
  const xS = 56;
  const xA = 230;
  const xN = 500;
  const yRow = (i: number) => TOP + ROW / 2 + i * ROW;
  // A state on the left sits at the middle of its action rows; next states spread over the full height on the right.
  const yLeft = spec.states.map((_, s) => {
    const mine = rows.map((r, i) => (r.s === s ? yRow(i) : NaN)).filter(Number.isFinite);
    return mine.length ? (mine[0] + mine[mine.length - 1]) / 2 : NaN;
  });
  const span = rows.length * ROW;
  const yRight = spec.states.map((_, s) => TOP + ((s + 0.5) * Math.max(span, spec.states.length * ROW)) / spec.states.length);
  const short = (x: string) => (x.length > 8 ? x.slice(0, 7) + "…" : x);
  // Label placement: each label slides along its own arrow to the first position that clears the labels already
  // placed (estimated boxes: ~6 px per character, 12 px high), so crossing arrows never print on top of each other.
  const placed = new Map<string, { x: number; y: number; text: string }>();
  const boxes: { l: number; r: number; t: number; b: number }[] = [];
  const TRIES = [0.27, 0.42, 0.15, 0.55, 0.34, 0.2, 0.48, 0.62];
  rows.forEach(({ s, a }, i) =>
    spec.outcomes[s][a].forEach((o, k) => {
      if (!(o.prob > 0) || !spec.states[o.next]) return;
      const text = `${f(o.prob, 2)}, r ${f(o.reward, 1)}`;
      const w = text.length * 6;
      const at = (u: number) => ({ x: xA + u * (xN - 22 - xA), y: yRow(i) + u * (yRight[o.next] - yRow(i)) - 4 });
      const box = (p: { x: number; y: number }) => ({ l: p.x - w / 2, r: p.x + w / 2, t: p.y - 10, b: p.y + 2 });
      const clear = (bx: ReturnType<typeof box>) => boxes.every((q) => bx.r < q.l || q.r < bx.l || bx.b < q.t || q.b < bx.t);
      const p = TRIES.map(at).find((c) => clear(box(c))) ?? at(TRIES[0]);
      boxes.push(box(p));
      placed.set(`${s}-${a}-${k}`, { ...p, text });
    }),
  );
  return (
    <svg className="mdp-graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Transitions: each state, its available actions, and the next states each action can lead to, with probability and reward">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="anode" />
        </marker>
      </defs>
      <text className="elabel" x={xS} y={16} textAnchor="middle">
        state s
      </text>
      <text className="elabel" x={xA} y={16} textAnchor="middle">
        action a
      </text>
      <text className="elabel" x={xN} y={16} textAnchor="middle">
        next state s′
      </text>
      {rows.map(({ s, a }, i) => (
        <g key={`r${s}-${a}`}>
          <line className="edge" x1={xS + 20} y1={yLeft[s]} x2={xA - 5} y2={yRow(i)} />
          <circle className="anode" cx={xA} cy={yRow(i)} r={5} />
          <text x={xA} y={yRow(i) - 9} textAnchor="middle" className="elabel">
            {short(spec.actions[a])}
          </text>
          {spec.outcomes[s][a].map((o, k) =>
            o.prob > 0 && spec.states[o.next] ? (
              <g key={k}>
                <line className="edge" markerEnd="url(#arrow)" x1={xA + 5} y1={yRow(i)} x2={xN - 22} y2={yRight[o.next]} />
                {(() => {
                  const l = placed.get(`${s}-${a}-${k}`)!;
                  return (
                    <text className="elabel" x={l.x} y={l.y} textAnchor="middle">
                      {l.text}
                    </text>
                  );
                })()}
              </g>
            ) : null,
          )}
        </g>
      ))}
      {spec.states.map((st, s) => (
        <g key={s}>
          {Number.isFinite(yLeft[s]) && (
            <g className={`state ${st.terminal ? "terminal" : ""}`}>
              <circle cx={xS} cy={yLeft[s]} r={20} />
              <text x={xS} y={yLeft[s] + 4} textAnchor="middle">
                {short(st.name)}
              </text>
            </g>
          )}
          <g className={`state ${st.terminal ? "terminal" : ""}`}>
            <circle cx={xN} cy={yRight[s]} r={20} />
            <text x={xN} y={yRight[s] + 4} textAnchor="middle">
              {short(st.name)}
            </text>
          </g>
        </g>
      ))}
    </svg>
  );
}

type PresetKey = "recycling" | "gridworld" | "blank";

export function MdpExplorer() {
  const [preset, setPreset] = useState<PresetKey>("recycling");
  const [params, setParams] = useState<RecyclingParams>(RECYCLING_DEFAULTS);
  const [spec, setSpec] = useState<MdpSpec>(() => recyclingSpec());
  const [sel, setSel] = useState(0);
  const load = (k: PresetKey) => {
    setPreset(k);
    setSel(0);
    setSpec(k === "recycling" ? recyclingSpec(params, spec.gamma) : k === "gridworld" ? gridworldSpec() : blankSpec());
  };
  const setParam = (p: Partial<RecyclingParams>) => {
    const np = { ...params, ...p };
    setParams(np);
    setSpec((s) => ({ ...recyclingSpec(np, s.gamma), policy: s.policy }));
  };
  const problems = useMemo(() => checkSpec(spec), [spec]);
  const evaluation = useMemo(() => {
    if (problems.length) return null;
    const { mdp, pi } = toMdp(spec);
    const exact = solveExact(mdp, pi, spec.gamma);
    const it = exact ? iterativePolicyEvaluation(mdp, pi, spec.gamma, { theta: 1e-6, maxSweeps: 10_000, mode: "in-place" }) : null;
    return { mdp, pi, exact, it, residual: exact ? bellmanResidual(mdp, exact, pi, spec.gamma) : NaN };
  }, [spec, problems]);
  const s = Math.min(sel, spec.states.length - 1);
  const isGrid = preset === "gridworld";

  return (
    <>
      <section className="card" aria-labelledby="mdp-h">
        <h2 id="mdp-h">The MDP</h2>
        <div className="inputs">
          <label>
            Preset{" "}
            <select value={preset} onChange={(e) => load(e.target.value as PresetKey)}>
              <option value="recycling">Recycling robot (Example 3.7)</option>
              <option value="gridworld">4×4 gridworld (Example 4.1)</option>
              <option value="blank">Start small (2 states)</option>
            </select>
          </label>
          <label>
            Discount γ{" "}
            <NumberInput label="Discount γ" value={spec.gamma} min={0} max={1} onChange={(x) => setSpec({ ...spec, gamma: x })} describedBy="gamma-help" />
          </label>
        </div>
        <p id="gamma-help" className="muted small">
          γ ∈ [0, 1]. With γ = 1, <Tex tex="v_\pi" /> exists only if every state eventually reaches a terminal state under π (p. 90).
        </p>
        {preset === "recycling" && (
          <>
            <p className="muted small">
              Table 3.1 with your own numbers: the draft leaves <Tex tex="\alpha, \beta, r_{\text{search}}, r_{\text{wait}}" /> symbolic (with <Tex tex="r_{\text{search}} > r_{\text{wait}}" />). Recharge is not available in
              high. The table gives expected rewards, used here as fixed rewards; that gives the same <Tex tex="v_\pi" />.
            </p>
            <div className="inputs">
              {(
                [
                  ["alpha", "α (high stays high when searching)"],
                  ["beta", "β (low stays low when searching)"],
                  ["rSearch", "r_search"],
                  ["rWait", "r_wait"],
                ] as const
              ).map(([k, label]) => (
                <label key={k}>
                  {label} <NumberCell value={params[k]} label={label} prob={k === "alpha" || k === "beta"} onChange={(x) => setParam({ [k]: x })} />
                </label>
              ))}
            </div>
            {!(params.rSearch > params.rWait) && <p className="flag">The draft assumes r_search &gt; r_wait; your numbers do not.</p>}
          </>
        )}
        {spec.states.length <= 6 ? <TransitionGraph spec={spec} /> : <p className="muted small">The diagram is drawn for up to 6 states; this MDP has {spec.states.length}. Use the tables below.</p>}
      </section>

      <section className="card" aria-labelledby="dyn-h">
        <h2 id="dyn-h">States, actions and dynamics</h2>
        {!isGrid && (
          <div className="actions">
            <button type="button" className="btn" disabled={spec.states.length >= MAX_STATES} onClick={() => (setPreset("blank"), setSpec(addState(spec)))}>
              Add state
            </button>
            <button type="button" className="btn" disabled={spec.actions.length >= MAX_ACTIONS} onClick={() => (setPreset("blank"), setSpec(addAction(spec)))}>
              Add action
            </button>
          </div>
        )}
        {!isGrid && (
          <div className="inputs">
            {spec.actions.map((a, i) => (
              <label key={i}>
                Action {i + 1}{" "}
                <input className="mini-input" value={a} aria-label={`Name of action ${i + 1}`} onChange={(e) => setSpec({ ...spec, actions: spec.actions.map((x, j) => (j === i ? e.target.value : x)) })} />
                {spec.actions.length > 1 && (
                  <button type="button" className="btn btn-small" aria-label={`Remove action ${a}`} onClick={() => (setPreset("blank"), setSpec(removeAction(spec, i)))}>
                    ×
                  </button>
                )}
              </label>
            ))}
          </div>
        )}
        <div className="inputs">
          <label>
            Edit state{" "}
            <select value={s} onChange={(e) => setSel(Number(e.target.value))}>
              {spec.states.map((st, i) => (
                <option key={i} value={i}>
                  {st.name}
                  {st.terminal ? " (terminal)" : ""}
                </option>
              ))}
            </select>
          </label>
          {!isGrid && (
            <>
              <label>
                Name <input className="mini-input" value={spec.states[s].name} onChange={(e) => setSpec({ ...spec, states: spec.states.map((x, i) => (i === s ? { ...x, name: e.target.value } : x)) })} />
              </label>
              <label className="check">
                <input type="checkbox" checked={spec.states[s].terminal} onChange={(e) => setSpec({ ...spec, states: spec.states.map((x, i) => (i === s ? { ...x, terminal: e.target.checked } : x)) })} /> terminal
              </label>
              {spec.states.length > 1 && (
                <button type="button" className="btn btn-small" onClick={() => (setPreset("blank"), setSel(0), setSpec(removeState(spec, s)))}>
                  Remove state
                </button>
              )}
            </>
          )}
        </div>
        {spec.states[s].terminal ? (
          <p className="muted">Terminal: no actions; its value is 0.</p>
        ) : (
          spec.actions.map((act, a) => {
            const list = spec.outcomes[s][a];
            const sum = list.reduce((t, o) => t + (Number.isFinite(o.prob) ? o.prob : 0), 0);
            return (
              <fieldset key={a} className="outcomes">
                <legend>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={list.length > 0}
                      onChange={(e) => setSpec(setPolicy(setOutcomes(spec, s, a, e.target.checked ? [{ next: s, reward: 0, prob: 1 }] : []), s, a, e.target.checked ? spec.policy[s][a] : 0))}
                    />{" "}
                    {act} available in {spec.states[s].name}
                  </label>
                </legend>
                {list.length > 0 && (
                  <table className="lab-table">
                    <thead>
                      <tr>
                        <th scope="col">next state s′</th>
                        <th scope="col">reward r</th>
                        <th scope="col">p(s′, r | s, a)</th>
                        <th scope="col" />
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((o, i) => (
                        <tr key={i}>
                          <td>
                            <select aria-label={`Next state of outcome ${i + 1} for ${act}`} value={o.next} onChange={(e) => setSpec(setOutcomes(spec, s, a, list.map((x, j) => (j === i ? { ...x, next: Number(e.target.value) } : x))))}>
                              {spec.states.map((st, k) => (
                                <option key={k} value={k}>
                                  {st.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <NumberCell value={o.reward} label={`Reward of outcome ${i + 1} for ${act}`} onChange={(x) => setSpec(setOutcomes(spec, s, a, list.map((y, j) => (j === i ? { ...y, reward: x } : y))))} />
                          </td>
                          <td>
                            <NumberCell value={o.prob} prob label={`Probability of outcome ${i + 1} for ${act}`} onChange={(x) => setSpec(setOutcomes(spec, s, a, list.map((y, j) => (j === i ? { ...y, prob: x } : y))))} />
                          </td>
                          <td>
                            {list.length > 1 && (
                              <button type="button" className="btn btn-small" aria-label={`Remove outcome ${i + 1} for ${act}`} onClick={() => setSpec(setOutcomes(spec, s, a, list.filter((_, j) => j !== i)))}>
                                ×
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {list.length > 0 && (
                  <p className={`small ${Math.abs(sum - 1) > 1e-6 ? "errors" : "muted"}`}>
                    Sum of probabilities: {f(sum, 4)}
                    {Math.abs(sum - 1) > 1e-6 ? " (must be 1)" : ""}{" "}
                    <button type="button" className="btn btn-small" onClick={() => setSpec(setOutcomes(spec, s, a, [...list, { next: 0, reward: 0, prob: 0 }]))}>
                      Add outcome
                    </button>
                  </p>
                )}
              </fieldset>
            );
          })
        )}
        {!spec.states[s].terminal && (
          <fieldset className="outcomes">
            <legend>Policy π(a | {spec.states[s].name})</legend>
            <div className="inputs">
              {spec.actions.map((act, a) => (
                <label key={a}>
                  π({act}) <NumberCell value={spec.policy[s][a]} prob label={`π(${act} | ${spec.states[s].name})`} onChange={(x) => setSpec(setPolicy(spec, s, a, x))} />
                </label>
              ))}
              <button type="button" className="btn btn-small" onClick={() => setSpec({ ...spec, policy: uniformPolicy(spec) })}>
                Uniform over available actions (all states)
              </button>
            </div>
          </fieldset>
        )}
      </section>

      <section className="card" aria-labelledby="val-h" aria-live="polite">
        <h2 id="val-h">Values</h2>
        {problems.length > 0 ? (
          <div role="alert" className="errors">
            <p>
              <strong>Not computed: fix {problems.length === 1 ? "this problem" : `these ${problems.length} problems`} first.</strong>
            </p>
            <ul>
              {problems.slice(0, 12).map((p, i) => (
                <li key={i}>
                  {p.where}: {p.message}
                </li>
              ))}
            </ul>
          </div>
        ) : evaluation && !evaluation.exact ? (
          <p role="alert" className="errors">
            <Tex tex="v_\pi" /> does not exist here: with γ = {spec.gamma} the policy can keep going for ever without reaching a terminal state, so the returns are unbounded (the draft requires γ &lt; 1 or guaranteed
            termination, p. 90).
          </p>
        ) : (
          evaluation && (
            <>
              {isGrid && (
                <div className="vgrid" aria-label="v_π on the grid">
                  {toCells(evaluation.exact!).map((v, c) => (
                    <span key={c} className={c === 0 || c === 15 ? "t" : ""}>
                      {f(v, 1)}
                    </span>
                  ))}
                </div>
              )}
              <table className="lab-table">
                <caption>
                  <Tex tex="v_\pi" />, exactly and by iterative policy evaluation (in place, θ = 10⁻⁶)
                </caption>
                <thead>
                  <tr>
                    <th scope="col">State</th>
                    <th scope="col">exact (solving 4.4)</th>
                    <th scope="col">iterative ({evaluation.it!.sweeps} sweeps)</th>
                  </tr>
                </thead>
                <tbody>
                  {spec.states.map((st, i) => (
                    <tr key={i}>
                      <td>{st.name}</td>
                      <td className="num">{f(evaluation.exact![i], 4)}</td>
                      <td className="num">{f(evaluation.it!.v[i], 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted small">
                Largest violation of the Bellman equation (3.12) by the exact solution: {evaluation.residual.toExponential(1)}. Largest change in the last sweep: {evaluation.it!.deltas.at(-1)!.toExponential(1)}.
              </p>
              {!spec.states[s].terminal && (
                <table className="lab-table">
                  <caption>
                    From {spec.states[s].name}: expected reward <Tex tex="r(s,a)" /> (3.7) and transition probabilities <Tex tex="p(s'|s,a)" /> (3.8)
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">action</th>
                      <th scope="col">r(s, a)</th>
                      {spec.states.map((st, k) => (
                        <th key={k} scope="col">
                          p({st.name} | ·)
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {spec.actions.map((act, a) =>
                      available(spec, s, a) ? (
                        <tr key={a}>
                          <td>{act}</td>
                          <td className="num">{f(expectedReward(evaluation.mdp, s, a))}</td>
                          {spec.states.map((_, k) => (
                            <td key={k} className="num">
                              {f(transitionProb(evaluation.mdp, s, a, k))}
                            </td>
                          ))}
                        </tr>
                      ) : null,
                    )}
                  </tbody>
                </table>
              )}
            </>
          )
        )}
      </section>
    </>
  );
}
