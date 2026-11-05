// Bellman equation laboratory. Part 1: one state's backup (3.12) taken apart term by term, with the immediate-reward
// part and the discounted-future part shown separately. Part 2: the backup applied to every state, sweep by sweep
// (4.5), converging to the exact v_π. All arithmetic is lib/rl (backupTerms, iterativePolicyEvaluation, solveExact).
import { useMemo, useState } from "react";
import { backupTerms, equiprobablePolicy, solveExact, type FiniteMDP } from "../../lib/rl/mdp";
import { iterativePolicyEvaluation } from "../../lib/rl/dp";
import { gridworld4x4, toCells } from "../../lib/rl/envs/gridworld4x4";
import { recyclingRandomPolicy, recyclingRobot } from "../../lib/rl/envs/recycling";
import { RECYCLING_DEFAULTS } from "../../domain/mdpModel";
import { LineChart } from "../../components/LineChart";
import { Tex } from "../../components/math";

const f = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "–");

interface Branch {
  label: string;
  pi: number;
  outcomes: { p: number; r: number; v: number }[]; // successor value v(s′) set by the learner
}
/** Exercise 3.9: the centre state of Figure 3.5b, four equally likely moves, reward 0, γ = 0.9. */
const EX39: Branch[] = [
  { label: "north", pi: 0.25, outcomes: [{ p: 1, r: 0, v: 2.3 }] },
  { label: "east", pi: 0.25, outcomes: [{ p: 1, r: 0, v: 0.4 }] },
  { label: "south", pi: 0.25, outcomes: [{ p: 1, r: 0, v: -0.4 }] },
  { label: "west", pi: 0.25, outcomes: [{ p: 1, r: 0, v: 0.7 }] },
];

/** The one-state backup as a FiniteMDP whose successors are terminal states holding the given values. */
function asMdp(branches: Branch[]) {
  const succ: number[] = [0];
  const dynamics: FiniteMDP["dynamics"] = [[]];
  branches.forEach((b) => {
    dynamics[0].push(
      b.outcomes.map((o) => {
        succ.push(o.v);
        dynamics.push([]);
        return { next: succ.length - 1, reward: o.r, prob: o.p };
      }),
    );
  });
  const n = succ.length;
  const mdp: FiniteMDP = { states: succ.map((_, i) => (i ? `s′${i}` : "s")), terminal: succ.map((_, i) => i > 0), actions: branches.map((b) => b.label), dynamics: dynamics.map((row, i) => (i ? branches.map(() => []) : row)) };
  const pi = Array.from({ length: n }, (_, i) => (i ? branches.map(() => 0) : branches.map((b) => b.pi)));
  return { mdp, pi, v: succ };
}

function Num({ value, onChange, label }: { value: number; onChange: (x: number) => void; label: string }) {
  const [t, setT] = useState<string | null>(null);
  return (
    <input
      className="mini-input"
      aria-label={label}
      inputMode="decimal"
      value={t ?? String(value)}
      onChange={(e) => {
        setT(e.target.value);
        const x = Number(e.target.value);
        if (e.target.value.trim() !== "" && Number.isFinite(x)) onChange(x);
      }}
      onBlur={() => setT(null)}
    />
  );
}

function PartsBar({ reward, future }: { reward: number; future: number }) {
  const m = Math.max(1e-9, Math.abs(reward), Math.abs(future), Math.abs(reward + future));
  const row = (label: string, x: number) => (
    <>
      <span>{label}</span>
      <span className="track" aria-hidden="true">
        <span className={`fill ${x < 0 ? "neg" : ""}`} style={{ left: x < 0 ? `${50 - (50 * -x) / m}%` : "50%", width: `${(50 * Math.abs(x)) / m}%` }} />
      </span>
      <span className="num">{f(x)}</span>
    </>
  );
  return (
    <div className="parts-bar" role="group" aria-label="Immediate reward and discounted future">
      {row("immediate reward", reward)}
      {row("discounted future", future)}
      {row("v(s) total", reward + future)}
    </div>
  );
}

function SingleBackup() {
  const [branches, setBranches] = useState<Branch[]>(EX39);
  const [gamma, setGamma] = useState(0.9);
  const edit = (i: number, b: Partial<Branch>) => setBranches(branches.map((x, j) => (j === i ? { ...x, ...b } : x)));
  const editO = (i: number, k: number, o: Partial<Branch["outcomes"][number]>) => edit(i, { outcomes: branches[i].outcomes.map((x, j) => (j === k ? { ...x, ...o } : x)) });
  const piSum = branches.reduce((t, b) => t + b.pi, 0);
  const bad = [
    ...(Math.abs(piSum - 1) > 1e-6 ? [`π(·|s) sums to ${f(piSum, 4)}, not 1.`] : []),
    ...branches.flatMap((b) => {
      const s = b.outcomes.reduce((t, o) => t + o.p, 0);
      return [...(Math.abs(s - 1) > 1e-6 ? [`p(·|s, ${b.label}) sums to ${f(s, 4)}, not 1.`] : []), ...(b.outcomes.some((o) => o.p < 0 || o.p > 1) || b.pi < 0 || b.pi > 1 ? [`${b.label}: probabilities must lie in [0, 1].`] : [])];
    }),
    ...(gamma < 0 || gamma > 1 ? ["γ must lie in [0, 1]."] : []),
  ];
  const res = useMemo(() => {
    const { mdp, pi, v } = asMdp(branches);
    return backupTerms(mdp, v, pi, 0, gamma);
  }, [branches, gamma]);
  return (
    <section className="card" aria-labelledby="one-h">
      <h2 id="one-h">One state's Bellman equation</h2>
      <p>
        <Tex tex="v_\pi(s) = \sum_a \pi(a|s) \sum_{s',r} p(s',r|s,a)\big[r + \gamma v_\pi(s')\big]" display />
      </p>
      <p className="muted small">
        Preset: Exercise 3.9, the centre state of Figure 3.5b, with the printed neighbour values. Change anything; the successor values are held fixed here, as if already known.
      </p>
      <div className="inputs">
        <label>
          γ <Num value={gamma} label="discount rate γ" onChange={setGamma} />
        </label>
        <button type="button" className="btn btn-small" onClick={() => (setBranches(EX39), setGamma(0.9))}>
          Reset to Exercise 3.9
        </button>
      </div>
      {branches.map((b, i) => (
        <fieldset key={i} className="outcomes">
          <legend>
            Action {b.label}: π = <Num value={b.pi} label={`π(${b.label} | s)`} onChange={(x) => edit(i, { pi: x })} />
          </legend>
          {b.outcomes.map((o, k) => (
            <div key={k} className="inputs">
              <span className="muted small">outcome {k + 1}:</span>
              <label>
                p <Num value={o.p} label={`p for ${b.label} outcome ${k + 1}`} onChange={(x) => editO(i, k, { p: x })} />
              </label>
              <label>
                r <Num value={o.r} label={`r for ${b.label} outcome ${k + 1}`} onChange={(x) => editO(i, k, { r: x })} />
              </label>
              <label>
                v(s′) <Num value={o.v} label={`v(s′) for ${b.label} outcome ${k + 1}`} onChange={(x) => editO(i, k, { v: x })} />
              </label>
              {b.outcomes.length > 1 && (
                <button type="button" className="btn btn-small" aria-label={`Remove outcome ${k + 1} of ${b.label}`} onClick={() => edit(i, { outcomes: b.outcomes.filter((_, j) => j !== k) })}>
                  ×
                </button>
              )}
            </div>
          ))}
          {b.outcomes.length < 3 && (
            <button type="button" className="btn btn-small" onClick={() => edit(i, { outcomes: [...b.outcomes, { p: 0, r: 0, v: 0 }] })}>
              Add outcome
            </button>
          )}
        </fieldset>
      ))}
      {bad.length ? (
        <ul role="alert" className="errors">
          {bad.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ) : (
        <>
          <table className="lab-table">
            <caption>Each term π(a|s)·p(s′,r|s,a)·[r + γ v(s′)], split in two</caption>
            <thead>
              <tr>
                <th scope="col">action</th>
                <th scope="col">π·p</th>
                <th scope="col">r</th>
                <th scope="col">γ v(s′)</th>
                <th scope="col">π·p·r</th>
                <th scope="col">π·p·γ v(s′)</th>
              </tr>
            </thead>
            <tbody>
              {res.terms.map((x, i) => (
                <tr key={i}>
                  <td>{branches[x.action].label}</td>
                  <td className="num">{f(x.weight)}</td>
                  <td className="num">{f(x.reward)}</td>
                  <td className="num">{f(x.weight ? x.futurePart / x.weight : 0)}</td>
                  <td className="num">{f(x.rewardPart)}</td>
                  <td className="num">{f(x.futurePart)}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" colSpan={4}>
                  Sums
                </th>
                <td className="num">{f(res.reward)}</td>
                <td className="num">{f(res.future)}</td>
              </tr>
            </tbody>
          </table>
          <PartsBar reward={res.reward} future={res.future} />
          <p role="status">
            <strong>v(s) = {f(res.reward)} + {f(res.future)} = {f(res.total)}</strong>
          </p>
        </>
      )}
    </section>
  );
}

type Model = "recycling" | "gridworld";

export function Iteration() {
  const [model, setModel] = useState<Model>("gridworld");
  const [gamma, setGamma] = useState(1);
  const [mode, setMode] = useState<"two-array" | "in-place">("two-array");
  const [k, setK] = useState(0);
  const [state, setState] = useState(1);
  const { mdp, pi } = useMemo(() => (model === "gridworld" ? (() => {
    const g = gridworld4x4();
    return { mdp: g, pi: equiprobablePolicy(g) };
  })() : { mdp: recyclingRobot(RECYCLING_DEFAULTS), pi: recyclingRandomPolicy() }), [model]);
  const g = model === "gridworld" ? 1 : gamma;
  const MAXK = 200;
  const hist = useMemo(() => iterativePolicyEvaluation(mdp, pi, g, { theta: 0, maxSweeps: MAXK, mode, record: true }), [mdp, pi, g, mode]);
  const exact = useMemo(() => solveExact(mdp, pi, g), [mdp, pi, g]);
  const vk = hist.history[k];
  const s = Math.min(Math.max(state, 0), mdp.states.length - 1);
  const terms = backupTerms(mdp, vk, pi, s, g);
  const err = exact ? hist.history.map((v) => Math.max(...v.map((x, i) => Math.abs(x - exact[i])))) : null;
  return (
    <section className="card" aria-labelledby="it-h">
      <h2 id="it-h">Applying the backup to every state, again and again</h2>
      <p className="muted small">
        Iterative policy evaluation (4.5): <Tex tex="v_{k+1}(s) = \sum_a \pi(a|s)\sum_{s',r} p(s',r|s,a)[r + \gamma v_k(s')]" />, starting from <Tex tex="v_0 = 0" />. The fixed point is <Tex tex="v_\pi" />.
      </p>
      <div className="inputs">
        <label>
          MDP{" "}
          <select value={model} onChange={(e) => (setModel(e.target.value as Model), setK(0), setState(e.target.value === "gridworld" ? 1 : 0))}>
            <option value="gridworld">4×4 gridworld, random policy, γ = 1 (Example 4.1)</option>
            <option value="recycling">Recycling robot, random policy (Example 3.7, sample numbers)</option>
          </select>
        </label>
        {model === "recycling" && (
          <label>
            γ <Num value={gamma} label="discount rate γ for the recycling robot" onChange={(x) => (setGamma(Math.min(0.99, Math.max(0, x))), setK(0))} />
          </label>
        )}
        <label>
          Sweep{" "}
          <select value={mode} onChange={(e) => (setMode(e.target.value as "two-array" | "in-place"), setK(0))}>
            <option value="two-array">two arrays (v_k → v_k+1, as in Figure 4.2)</option>
            <option value="in-place">in place (Figure 4.1)</option>
          </select>
        </label>
      </div>
      <div className="actions">
        <button type="button" className="btn" disabled={k === 0} onClick={() => setK(k - 1)}>
          ← Back
        </button>
        <button type="button" className="btn btn-primary" disabled={k >= MAXK} onClick={() => setK(k + 1)}>
          Next sweep
        </button>
        <button type="button" className="btn" disabled={k >= MAXK} onClick={() => setK(Math.min(MAXK, k + 10))}>
          +10 sweeps
        </button>
        <button type="button" className="btn" disabled={k === 0} onClick={() => setK(0)}>
          Reset
        </button>
      </div>
      <p role="status" className="muted">
        k = {k}
        {k > 0 ? ` · largest change in sweep ${k}: Δ = ${hist.deltas[k - 1].toExponential(2)}` : ""}
        {err ? ` · largest gap to v_π: ${err[k].toExponential(2)}` : ""}
      </p>
      {model === "gridworld" ? (
        <div className="lab-grid">
          <div>
            <p className="small">
              <Tex tex="v_k" />, k = {k}
            </p>
            <div className="vgrid">
              {toCells(vk).map((x, c) => (
                <span key={c} className={c === 0 || c === 15 ? "t" : ""}>
                  {f(x, 2)}
                </span>
              ))}
            </div>
            <p className="muted small">Compare k = 1, 2, 3 and 10 with Figure 4.2 (which prints one decimal, see the rounding note on Example 4.1).</p>
          </div>
          <div>
            <p className="small">
              exact <Tex tex="v_\pi" />
            </p>
            <div className="vgrid">
              {exact &&
                toCells(exact).map((x, c) => (
                  <span key={c} className={c === 0 || c === 15 ? "t" : ""}>
                    {f(x, 2)}
                  </span>
                ))}
            </div>
          </div>
        </div>
      ) : (
        <table className="lab-table">
          <thead>
            <tr>
              <th scope="col">state</th>
              <th scope="col">v_k (k = {k})</th>
              <th scope="col">exact v_π</th>
            </tr>
          </thead>
          <tbody>
            {mdp.states.map((st, i) => (
              <tr key={i}>
                <td>{st}</td>
                <td className="num">{f(vk[i], 4)}</td>
                <td className="num">{exact ? f(exact[i], 4) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="inputs">
        <label>
          Show the backup of state{" "}
          <select value={s} onChange={(e) => setState(Number(e.target.value))}>
            {mdp.states.map((st, i) =>
              mdp.terminal[i] ? null : (
                <option key={i} value={i}>
                  {st}
                </option>
              ),
            )}
          </select>
        </label>
      </div>
      <p className="small">
        Backing up {mdp.states[s]} from <Tex tex="v_k" /> gives {f(terms.reward)} (immediate) + {f(terms.future)} (discounted future) = <strong>{f(terms.total)}</strong>
        {mode === "two-array" && k < MAXK ? `, which is v_${k + 1}(${mdp.states[s]}) = ${f(hist.history[k + 1][s])}` : ""}.
      </p>
      <details>
        <summary>All {terms.terms.length} terms of this backup</summary>
        <table className="lab-table">
          <thead>
            <tr>
              <th scope="col">a</th>
              <th scope="col">s′</th>
              <th scope="col">π·p</th>
              <th scope="col">r</th>
              <th scope="col">v_k(s′)</th>
              <th scope="col">π·p·[r + γ v_k(s′)]</th>
            </tr>
          </thead>
          <tbody>
            {terms.terms.map((x, i) => (
              <tr key={i}>
                <td>{mdp.actions[x.action]}</td>
                <td>{mdp.states[x.next]}</td>
                <td className="num">{f(x.weight)}</td>
                <td className="num">{f(x.reward)}</td>
                <td className="num">{f(vk[x.next])}</td>
                <td className="num">{f(x.rewardPart + x.futurePart)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      {err && (
        <LineChart
          title="Largest gap between v_k and v_π, by sweep"
          series={[{ label: mode, values: err.slice(1, Math.max(2, k + 1)) }]}
          xLabel="Sweep"
          yLabel="max over states of |v_k − v_π|"
          format={(x) => (x >= 0.01 ? x.toFixed(2) : x.toExponential(0))}
          yMin={0}
        />
      )}
    </section>
  );
}

export function BellmanLab() {
  return (
    <>
      <SingleBackup />
      <Iteration />
    </>
  );
}
