// Dynamic programming laboratory: policy iteration stepped evaluation by improvement, and value iteration stepped
// sweep by sweep, with every value function, greedy policy, change and Δ shown. Computation: lib/rl/dp.ts.
import { useMemo, useState } from "react";
import { greedyPolicy, policyIteration, valueIteration } from "../../lib/rl/dp";
import type { FiniteMDP } from "../../lib/rl/mdp";
import { gridworld4x4, toCells } from "../../lib/rl/envs/gridworld4x4";
import { gamblersProblem, gridworld5x5, windyGridworld, type GridMDP } from "../../lib/rl/envs/examples";
import { recyclingRobot } from "../../lib/rl/envs/recycling";
import { RECYCLING_DEFAULTS } from "../../domain/mdpModel";
import { GridView } from "../../components/GridView";
import { LineChart } from "../../components/LineChart";
import { NumberInput } from "../../components/NumberInput";
import { Tex } from "../../components/math";
import { JackPanel } from "./JackPanel";

export type Env = "gridworld" | "grid5" | "gambler" | "recycling" | "windy";
const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "–");

export interface Model {
  mdp: FiniteMDP;
  gamma: number;
  kind: "grid4" | "grid" | "gambler" | "table";
  grid?: GridMDP["grid"];
  digits?: number; // decimals shown in grid cells
}

export function model(env: Env, ph: number): Model {
  if (env === "gridworld") return { mdp: gridworld4x4(), gamma: 1, kind: "grid4" };
  if (env === "gambler") return { mdp: gamblersProblem(ph), gamma: 1, kind: "gambler" };
  if (env === "grid5") {
    const g = gridworld5x5();
    return { mdp: g, gamma: 0.9, kind: "grid", grid: g.grid, digits: 1 };
  }
  if (env === "windy") {
    const w = windyGridworld();
    return { mdp: w, gamma: 1, kind: "grid", grid: w.grid };
  }
  return { mdp: recyclingRobot(RECYCLING_DEFAULTS), gamma: 0.9, kind: "table" };
}

/** Gambler: stake 0 always ties under γ = 1 (it keeps the capital), so the smallest positive maximizing stake is shown. */
const gamblerStake = (ties: number[]) => ties.find((a) => a > 0) ?? ties[0] ?? 0;

function ValuesView({ m, v, ties, changed }: { m: Model; v: number[]; ties: number[][]; changed?: number[] }) {
  if (m.kind === "grid4") {
    const cells = toCells(v);
    const tieCells = Array.from({ length: 16 }, (_, c) => (c === 0 || c === 15 ? [] : ties[c]));
    return <GridView rows={4} cols={4} stateAt={(r, c) => r * 4 + c} label="Values and greedy actions on the 4×4 gridworld" values={cells} arrows={tieCells} terminal={cells.map((_, c) => c === 0 || c === 15)} path={changed} />;
  }
  if (m.kind === "grid" && m.grid) {
    const g = m.grid;
    return <GridView rows={g.rows} cols={g.cols} stateAt={(r, c) => r * g.cols + c} label="Values and greedy actions" values={v} arrows={ties} start={g.start} goals={g.goal} terminal={m.mdp.terminal} wind={g.wind} path={changed} digits={m.digits ?? 0} marks={g.marks} />;
  }
  if (m.kind === "gambler") {
    const stakes = v.map((_, s) => (m.mdp.terminal[s] ? 0 : gamblerStake(ties[s])));
    return (
      <>
        {/* Capital $1–$99, as in Figure 4.6; the terminal $0 and $100 have value 0 by definition. */}
        <LineChart title="Value estimate by capital" series={[{ label: "v", values: v.slice(1, 100) }]} xLabel="Capital" yLabel="probability of reaching $100" format={(x) => x.toFixed(3)} yMin={0} yMax={1} />
        <LineChart title="Greedy stake (smallest positive maximizing stake)" series={[{ label: "stake", values: stakes.slice(1, 100) }]} xLabel="Capital" yLabel="stake" format={(x) => x.toFixed(0)} yMin={0} />
      </>
    );
  }
  return (
    <table className="lab-table">
      <thead>
        <tr>
          <th scope="col">state</th>
          <th scope="col">value</th>
          <th scope="col">greedy action(s)</th>
        </tr>
      </thead>
      <tbody>
        {m.mdp.states.map((st, s) => (
          <tr key={s} className={changed?.includes(s) ? "chosen" : ""}>
            <td>{st}</td>
            <td className="num">{f(v[s], 4)}</td>
            <td>{ties[s].map((a) => m.mdp.actions[a]).join(" or ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PolicyIterationPanel({ m }: { m: Model }) {
  const run = useMemo(() => policyIteration(m.mdp, m.gamma, { theta: 1e-9 }), [m]);
  const phases = run.steps.length * 2 - 1;
  const [p, setP] = useState(0);
  const k = Math.floor(p / 2);
  const step = run.steps[k];
  const improving = p % 2 === 1;
  const next = run.steps[k + 1];
  return (
    <section className="card" aria-labelledby="pi-h">
      <h2 id="pi-h">Policy iteration (Figure 4.3)</h2>
      <p className="muted small">
        <Tex tex="\pi_0 \xrightarrow{E} v_{\pi_0} \xrightarrow{I} \pi_1 \xrightarrow{E} v_{\pi_1} \xrightarrow{I} \cdots" />. Here π₀ is the equiprobable random policy; each evaluation starts from the previous values; an action is kept while it is still among the best (the fix for the bug the draft notes under Figure 4.3).
      </p>
      <div className="actions">
        <button type="button" className="btn" disabled={p === 0} onClick={() => setP(p - 1)}>
          ← Back
        </button>
        <button type="button" className="btn btn-primary" disabled={p >= phases - 1} onClick={() => setP(p + 1)}>
          {improving ? "Evaluate the new policy" : "Improve the policy"}
        </button>
        <button type="button" className="btn" disabled={p >= phases - 1} onClick={() => setP(phases - 1)}>
          To the end
        </button>
      </div>
      <p role="status">
        {improving ? (
          <>
            <strong>Improvement {k + 1}:</strong> greedy with respect to <Tex tex={`v_{\\pi_${k}}`} />; {step.changed.length} state{step.changed.length === 1 ? "" : "s"} changed action (outlined).
          </>
        ) : (
          <>
            <strong>Evaluation {k}:</strong> <Tex tex={`v_{\\pi_${k}}`} /> after {step.sweeps} sweep{step.sweeps === 1 ? "" : "s"} of in-place policy evaluation
            {k === run.steps.length - 1 && run.stable ? ". The next improvement changes nothing: the policy is stable, hence optimal." : "."}
          </>
        )}
      </p>
      {run.diverged && <p className="flag">An evaluation did not converge (with γ = 1 this policy can loop for ever; see Exercise 4.4).</p>}
      <ValuesView m={m} v={step.v} ties={improving && next ? next.ties : step.ties} changed={improving ? step.changed : undefined} />
      <p className="muted small">
        Arrows: every action maximizing <Tex tex="\sum_{s',r} p(s',r|s,a)[r + \gamma V(s')]" /> for the values shown (ties drawn together, as in Figure 4.2). Policy iteration finished after {run.steps.length} evaluation
        {run.steps.length === 1 ? "" : "s"}.
      </p>
    </section>
  );
}

export function ValueIterationPanel({ m }: { m: Model }) {
  const [mode, setMode] = useState<"in-place" | "two-array">("in-place");
  const run = useMemo(() => valueIteration(m.mdp, m.gamma, { theta: 1e-10, record: true, mode, maxSweeps: 2000 }), [m, mode]);
  const [k, setK] = useState(0);
  const kk = Math.min(k, run.history.length - 1);
  const v = run.history[kk];
  const ties = useMemo(() => greedyPolicy(m.mdp, v, m.gamma).ties, [m, v]);
  return (
    <section className="card" aria-labelledby="vi-h">
      <h2 id="vi-h">Value iteration (Figure 4.5)</h2>
      <p className="muted small">
        <Tex tex="v_{k+1}(s) = \max_a \sum_{s',r} p(s',r|s,a)\big[r + \gamma v_k(s')\big]" /> (4.10), from <Tex tex="v_0 = 0" />, until the largest change Δ &lt; 10⁻¹⁰.
      </p>
      <div className="inputs">
        <label>
          Sweep{" "}
          <select value={mode} onChange={(e) => (setMode(e.target.value as "in-place" | "two-array"), setK(0))}>
            <option value="in-place">in place (Figure 4.5)</option>
            <option value="two-array">two arrays</option>
          </select>
        </label>
      </div>
      <div className="actions">
        <button type="button" className="btn" disabled={kk === 0} onClick={() => setK(kk - 1)}>
          ← Back
        </button>
        <button type="button" className="btn btn-primary" disabled={kk >= run.history.length - 1} onClick={() => setK(kk + 1)}>
          Next sweep
        </button>
        <button type="button" className="btn" disabled={kk >= run.history.length - 1} onClick={() => setK(run.history.length - 1)}>
          To convergence ({run.sweeps} sweeps)
        </button>
      </div>
      <p role="status">
        k = {kk}
        {kk > 0 ? ` · Δ in sweep ${kk} = ${run.deltas[kk - 1].toExponential(2)}` : ""}
        {kk === run.history.length - 1 ? " · converged" : ""}
      </p>
      <ValuesView m={m} v={v} ties={ties} />
      {run.deltas.length > 1 && <LineChart title="Largest change Δ in each sweep" series={[{ label: "Δ", values: run.deltas }]} xLabel="Sweep" yLabel="Δ" format={(x) => (x >= 0.01 ? x.toFixed(2) : x.toExponential(0))} yMin={0} />}
    </section>
  );
}

export function DpLab() {
  const [env, setEnv] = useState<Env>("gridworld");
  const [ph, setPh] = useState(0.4);
  const [algo, setAlgo] = useState<"pi" | "vi">("pi");
  const m = useMemo(() => model(env, ph), [env, ph]);
  return (
    <>
      <section className="card" aria-labelledby="dp-h">
        <h2 id="dp-h">Choose a problem</h2>
        <div className="inputs">
          <label>
            Problem{" "}
            <select value={env} onChange={(e) => setEnv(e.target.value as Env)}>
              <option value="gridworld">4×4 gridworld (Example 4.1), γ = 1</option>
              <option value="grid5">5×5 gridworld (Examples 3.8 and 3.12), γ = 0.9</option>
              <option value="gambler">Gambler's problem (Example 4.3), γ = 1</option>
              <option value="recycling">Recycling robot (Example 3.7, sample numbers), γ = 0.9</option>
              <option value="windy">Windy gridworld (Example 6.5), γ = 1</option>
            </select>
          </label>
          {env === "gambler" && (
            <label>
              p_h <NumberInput label="probability of heads p_h" value={ph} min={0.01} max={0.99} onChange={setPh} />
            </label>
          )}
          <label>
            Method{" "}
            <select value={env === "gambler" ? "vi" : algo} onChange={(e) => setAlgo(e.target.value as "pi" | "vi")}>
              <option value="pi" disabled={env === "gambler"}>
                policy iteration
              </option>
              <option value="vi">value iteration</option>
            </select>
          </label>
        </div>
        {env === "gambler" && (
          <p className="muted small">
            States are capital $1–$99; stakes run from 0 to min(s, 100 − s); +1 on reaching $100. A stake of 0 is in the draft's action set and ties for the maximum under γ = 1, so the stake chart shows the
            smallest positive maximizing stake. The draft solves this problem by value iteration (Figure 4.6); policy iteration is not offered here, because a policy that stakes 0 never ends an episode, so its
            evaluation cannot be trusted.
          </p>
        )}
      </section>
      {algo === "pi" && env !== "gambler" ? <PolicyIterationPanel key={`${env}-${ph}`} m={m} /> : <ValueIterationPanel key={`${env}-${ph}`} m={m} />}
      <JackPanel />
    </>
  );
}
