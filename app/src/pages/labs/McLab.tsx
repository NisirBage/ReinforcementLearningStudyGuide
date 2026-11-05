// Monte Carlo laboratory: episodes with their returns computed backwards, first-visit vs every-visit updates with
// sample averages or constant α, the error against the true values, and Monte Carlo ES on the gridworld.
import { useMemo, useState } from "react";
import { makeRng } from "../../domain/random";
import { equiprobablePolicy, solveExact, type FiniteMDP } from "../../lib/rl/mdp";
import { valueIteration } from "../../lib/rl/dp";
import { generateEpisode, type Step } from "../../lib/rl/sampling";
import { esEpisode, mcUpdate, newEs, newPrediction, returnsOf, type EsState, type McUpdate, type PredictionState } from "../../lib/rl/mc";
import { rmsError } from "../../lib/rl/td";
import { gridworld4x4, toCells } from "../../lib/rl/envs/gridworld4x4";
import { RANDOM_WALK_START, randomWalk } from "../../lib/rl/envs/examples";
import { GridView } from "../../components/GridView";
import { LineChart } from "../../components/LineChart";
import { NumberInput } from "../../components/NumberInput";
import { Tex } from "../../components/math";

type Env = "walk" | "grid";
const f = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "–");

function envOf(env: Env): { mdp: FiniteMDP; start: () => number; label: string } {
  if (env === "walk") return { mdp: randomWalk(), start: () => RANDOM_WALK_START, label: "Random walk (Example 6.2): start at C, +1 on the right" };
  const g = gridworld4x4();
  return { mdp: g, start: () => 6, label: "4×4 gridworld (Example 4.1), random policy, starting in state 6" };
}

interface Run {
  st: PredictionState;
  episodes: number;
  last: { steps: Step[]; updates: McUpdate[] } | null;
  rms: number[];
}

function Prediction() {
  const [env, setEnv] = useState<Env>("walk");
  const [firstVisit, setFirstVisit] = useState(true);
  const [constant, setConstant] = useState(false);
  const [alpha, setAlpha] = useState(0.05);
  const [seed, setSeed] = useState(1);
  const e = useMemo(() => envOf(env), [env]);
  const pi = useMemo(() => equiprobablePolicy(e.mdp), [e]);
  const truth = useMemo(() => solveExact(e.mdp, pi, 1)!, [e, pi]);
  const states = useMemo(() => e.mdp.states.map((_, s) => s).filter((s) => !e.mdp.terminal[s]), [e]);
  const fresh = (): Run => {
    const st = newPrediction(e.mdp.states.length, env === "walk" ? 0.5 : 0);
    st.V = st.V.map((x, s) => (e.mdp.terminal[s] ? 0 : x));
    return { st, episodes: 0, last: null, rms: [rmsError(st.V, truth, states)] };
  };
  const [run, setRun] = useState<Run>(fresh);
  const reset = () => setRun(fresh());
  const play = (n: number) =>
    setRun((r) => {
      let st = r.st;
      let last = r.last;
      const rms = [...r.rms];
      for (let i = 0; i < n; i++) {
        // Episode k of seed s always uses the same random numbers, so a run can be repeated exactly.
        const rng = makeRng(seed * 100_003 + r.episodes + i + 1);
        const ep = generateEpisode(e.mdp, pi, e.start(), rng);
        const out = mcUpdate(st, ep.steps, 1, firstVisit, constant ? alpha : undefined);
        st = out.state;
        last = { steps: ep.steps, updates: out.updates };
        rms.push(rmsError(st.V, truth, states));
      }
      return { st, episodes: r.episodes + n, last, rms };
    });
  const name = (s: number) => e.mdp.states[s];
  return (
    <section className="card" aria-labelledby="mcp-h">
      <h2 id="mcp-h">Monte Carlo prediction</h2>
      <div className="inputs">
        <label>
          Task{" "}
          <select value={env} onChange={(ev) => (setEnv(ev.target.value as Env), setRun({ st: newPrediction(1), episodes: 0, last: null, rms: [] }))}>
            <option value="walk">random walk (Example 6.2)</option>
            <option value="grid">4×4 gridworld, random policy</option>
          </select>
        </label>
        <label>
          Visits{" "}
          <select value={firstVisit ? "first" : "every"} onChange={(ev) => setFirstVisit(ev.target.value === "first")}>
            <option value="first">first-visit (Figure 5.1)</option>
            <option value="every">every-visit</option>
          </select>
        </label>
        <label>
          Step size{" "}
          <select value={constant ? "const" : "avg"} onChange={(ev) => setConstant(ev.target.value === "const")}>
            <option value="avg">1/N: the average of the returns</option>
            <option value="const">constant α (6.1)</option>
          </select>
        </label>
        {constant && (
          <label>
            α <NumberInput label="α" value={alpha} min={0.0001} max={1} onChange={setAlpha} />
          </label>
        )}
        <label>
          Seed <NumberInput label="seed" value={seed} integer onChange={setSeed} />
        </label>
      </div>
      <p className="muted small">{e.label}. The estimates start at {env === "walk" ? "0.5 (as in Figure 6.7)" : "0"}; the true values are solved exactly.</p>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={() => (run.rms.length ? play(1) : (reset(), play(1)))}>
          Generate an episode
        </button>
        <button type="button" className="btn" onClick={() => play(100)}>
          +100 episodes
        </button>
        <button type="button" className="btn" onClick={() => play(1000)}>
          +1000 episodes
        </button>
        <button type="button" className="btn" onClick={reset}>
          Reset
        </button>
      </div>
      <p role="status" className="muted">
        {run.episodes} episode{run.episodes === 1 ? "" : "s"} · RMS error over the nonterminal states: {run.rms.length ? f(run.rms.at(-1)!) : "–"}
      </p>
      {run.last && (
        <>
          <h3>The last episode, its returns and the updates they made</h3>
          <p className="muted small">
            Returns are computed backwards: <Tex tex="G_t = R_{t+1} + \gamma G_{t+1}" />, with <Tex tex="G_T = 0" /> and γ = 1.
          </p>
          <table className="lab-table">
            <thead>
              <tr>
                <th scope="col">t</th>
                <th scope="col">S_t</th>
                <th scope="col">R_t+1</th>
                <th scope="col">G_t</th>
                <th scope="col">visit</th>
                <th scope="col">V(S_t): before → after</th>
              </tr>
            </thead>
            <tbody>
              {run.last.updates.slice(0, 40).map((u) => (
                <tr key={u.t} className={u.applied ? "chosen" : ""}>
                  <td>{u.t}</td>
                  <td>{name(u.s)}</td>
                  <td className="num">{f(run.last!.steps[u.t].r, 0)}</td>
                  <td className="num">{f(u.G, 2)}</td>
                  <td>{u.first ? "first" : "repeat"}</td>
                  <td className="num">{u.applied ? `${f(u.before)} + ${f(u.stepSize)}·(${f(u.G, 2)} − ${f(u.before)}) = ${f(u.after)}` : "not used (not a first visit)"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {run.last.updates.length > 40 && <p className="muted small">First 40 of {run.last.updates.length} steps shown.</p>}
        </>
      )}
      {run.episodes > 0 &&
        (env === "walk" ? (
          <table className="lab-table">
            <caption>Estimates against the true values</caption>
            <thead>
              <tr>
                <th scope="col">state</th>
                {states.map((s) => (
                  <th key={s} scope="col">
                    {name(s)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>V</td>
                {states.map((s) => (
                  <td key={s} className="num">
                    {f(run.st.V[s])}
                  </td>
                ))}
              </tr>
              <tr>
                <td>true v_π</td>
                {states.map((s) => (
                  <td key={s} className="num">
                    {f(truth[s])}
                  </td>
                ))}
              </tr>
              <tr>
                <td>returns averaged</td>
                {states.map((s) => (
                  <td key={s} className="num">
                    {run.st.N[s]}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        ) : (
          <div className="lab-grid">
            <div>
              <p className="small">estimate V</p>
              <GridView rows={4} cols={4} stateAt={(r, c) => r * 4 + c} label="Monte Carlo estimates" values={toCells(run.st.V)} terminal={toCells(run.st.V).map((_, c) => c === 0 || c === 15)} />
            </div>
            <div>
              <p className="small">true v_π</p>
              <GridView rows={4} cols={4} stateAt={(r, c) => r * 4 + c} label="True values" values={toCells(truth)} terminal={toCells(truth).map((_, c) => c === 0 || c === 15)} />
            </div>
          </div>
        ))}
      {run.rms.length > 2 && <LineChart title="RMS error against the true values" series={[{ label: firstVisit ? "first-visit" : "every-visit", values: run.rms }]} xLabel="Episodes" yLabel="RMS error" format={(x) => x.toFixed(3)} yMin={0} xFrom={0} />}
    </section>
  );
}

function ExploringStarts() {
  const g = useMemo(() => gridworld4x4(), []);
  const optimal = useMemo(() => valueIteration(g, 1).policy.ties, [g]);
  const [seed, setSeed] = useState(7);
  const [es, setEs] = useState<{ st: EsState; episodes: number; truncated: number; last: ReturnType<typeof esEpisode> | null }>(() => ({ st: newEs(g), episodes: 0, truncated: 0, last: null }));
  const [sel, setSel] = useState(1);
  const play = (n: number) =>
    setEs((x) => {
      let st = x.st;
      let truncated = x.truncated;
      let last = x.last;
      for (let i = 0; i < n; i++) {
        const out = esEpisode(g, st, 1, makeRng(seed * 7919 + x.episodes + i + 1));
        st = out.state;
        last = out;
        if (out.truncated) truncated++;
      }
      return { st, episodes: x.episodes + n, truncated, last };
    });
  const isOptimal = es.st.policy.every((a, s) => g.terminal[s] || optimal[s].includes(a));
  const cells = Array.from({ length: 16 }, (_, c) => (c === 0 || c === 15 ? [] : [es.st.policy[c]]));
  return (
    <section className="card" aria-labelledby="es-h">
      <h2 id="es-h">Monte Carlo ES (Figure 5.4) on the 4×4 gridworld</h2>
      <p className="muted small">
        Each episode starts from a random state–action pair, then follows the current greedy policy π. The returns after first occurrences are averaged into <Tex tex="Q(s,a)" />, and π(s) becomes greedy in every state visited. The draft assumes every
        episode ends; a greedy policy here can walk into a wall for ever, so episodes are cut at 50 steps and their (strongly negative) returns are still averaged. That is a departure from the draft.
      </p>
      <div className="inputs">
        <label>
          Seed <NumberInput label="seed for Monte Carlo ES" value={seed} integer onChange={setSeed} />
        </label>
      </div>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={() => play(1)}>
          One episode
        </button>
        <button type="button" className="btn" onClick={() => play(1000)}>
          +1000 episodes
        </button>
        <button type="button" className="btn" onClick={() => setEs({ st: newEs(g), episodes: 0, truncated: 0, last: null })}>
          Reset
        </button>
      </div>
      <p role="status">
        {es.episodes} episodes · {es.truncated} cut off at 50 steps · greedy policy {isOptimal ? "is optimal (every arrow is one of the optimal actions)" : "is not yet optimal"}
      </p>
      {es.last && (
        <p className="muted small">
          Last episode: started with {g.states[es.last.steps[0]?.s ?? 0]}, {g.actions[es.last.steps[0]?.a ?? 0]}; {es.last.steps.length} steps
          {es.last.truncated ? " (cut off)" : ""}; return from the start {f(returnsOf(es.last.steps, 1)[0] ?? 0, 0)}.
        </p>
      )}
      <GridView rows={4} cols={4} stateAt={(r, c) => r * 4 + c} label="Greedy policy of Monte Carlo ES" arrows={cells} terminal={cells.map((_, c) => c === 0 || c === 15)} />
      <div className="inputs">
        <label>
          Q(s, ·) of state{" "}
          <select value={sel} onChange={(e) => setSel(Number(e.target.value))}>
            {g.states.map((st, s) =>
              g.terminal[s] ? null : (
                <option key={s} value={s}>
                  {st}
                </option>
              ),
            )}
          </select>
        </label>
      </div>
      <table className="lab-table">
        <thead>
          <tr>
            <th scope="col">action</th>
            <th scope="col">Q(s, a)</th>
            <th scope="col">returns averaged</th>
            <th scope="col">optimal?</th>
          </tr>
        </thead>
        <tbody>
          {g.actions.map((a, i) => (
            <tr key={a} className={es.st.policy[sel] === i ? "chosen" : ""}>
              <td>{a}</td>
              <td className="num">{f(es.st.Q[sel][i], 2)}</td>
              <td className="num">{es.st.N[sel][i]}</td>
              <td>{optimal[sel].includes(i) ? "yes" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function McLab() {
  return (
    <>
      <Prediction />
      <ExploringStarts />
    </>
  );
}
