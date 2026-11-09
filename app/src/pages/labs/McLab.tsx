// Monte Carlo laboratory: episodes with their returns computed backwards, first-visit vs every-visit updates with
// sample averages or constant α, the error against the true values, and Monte Carlo ES on blackjack (Example 5.3),
// checked against the exact optimum, with the gridworld as a demonstration of why ES needs episodes that end.
import { useMemo, useState } from "react";
import { makeRng } from "../../domain/random";
import { actionValue, equiprobablePolicy, solveExact, type FiniteMDP } from "../../lib/rl/mdp";
import { valueIteration } from "../../lib/rl/dp";
import { generateEpisode, type Step } from "../../lib/rl/sampling";
import { esEpisode, mcUpdate, newEs, newPrediction, returnsOf, runEs, type EsOptions, type EsState, type McUpdate, type PredictionState } from "../../lib/rl/mc";
import { HIT, STICK, bjIndex, bjName, bjStartPairs, blackjack, stickOn20 } from "../../lib/rl/envs/blackjack";
import { rmsError } from "../../lib/rl/td";
import { gridworld4x4, toCells } from "../../lib/rl/envs/gridworld4x4";
import { RANDOM_WALK_START, randomWalk } from "../../lib/rl/envs/examples";
import { GridView } from "../../components/GridView";
import { LineChart } from "../../components/LineChart";
import { NumberInput } from "../../components/NumberInput";
import { Tex } from "../../components/math";
import { ImportanceSampling, Racetrack } from "./OffPolicyPanels";

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

export function Prediction() {
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

type EsProblem = "blackjack" | "grid";
const GRID_CUT = 50;

/** Example 5.3's start: the policy of Example 5.1 (stick only on 20 or 21). */
const bjPolicy0 = () => stickOn20().map((row) => row.indexOf(1));

export function ExploringStarts() {
  const [problem, setProblem] = useState<EsProblem>("blackjack");
  return (
    <section className="card" aria-labelledby="es-h">
      <h2 id="es-h">Monte Carlo ES (Figure 5.4)</h2>
      <div className="inputs">
        <label>
          Problem{" "}
          <select value={problem} onChange={(e) => setProblem(e.target.value as EsProblem)}>
            <option value="blackjack">Blackjack (Example 5.3), as in the draft</option>
            <option value="grid">4×4 gridworld: why exploring starts needs episodes that end</option>
          </select>
        </label>
      </div>
      {problem === "blackjack" ? <EsBlackjack /> : <EsGrid />}
    </section>
  );
}

interface EsRun {
  st: EsState;
  episodes: number;
  truncated: number;
  last: ReturnType<typeof esEpisode> | null;
}

function useEs(mdp: FiniteMDP, opts: EsOptions, fresh: () => EsState, seed: number) {
  const [es, setEs] = useState<EsRun>(() => ({ st: fresh(), episodes: 0, truncated: 0, last: null }));
  const one = () =>
    setEs((x) => {
      const out = esEpisode(mdp, x.st, 1, makeRng(seed * 7919 + x.episodes + 1), opts);
      return { st: out.state, episodes: x.episodes + 1, truncated: x.truncated + (out.truncated ? 1 : 0), last: out };
    });
  const many = (n: number) =>
    setEs((x) => {
      const r = runEs(mdp, n, 1, makeRng(seed * 7919 + x.episodes + 1), { ...opts, from: x.st });
      return { st: r.state, episodes: x.episodes + n, truncated: x.truncated + r.truncated, last: null };
    });
  const reset = () => setEs({ st: fresh(), episodes: 0, truncated: 0, last: null });
  return { es, one, many, reset };
}

function EsBlackjack() {
  const m = useMemo(() => blackjack(), []);
  // The exact optimum, by value iteration on the same model: an independent check of what Monte Carlo ES learns.
  const best = useMemo(() => {
    const vi = valueIteration(m, 1, { theta: 1e-12 });
    return m.states.map((_, i) => (i >= 1 && i <= 200 ? (actionValue(m, vi.v, i, STICK, 1) >= actionValue(m, vi.v, i, HIT, 1) ? STICK : HIT) : -1));
  }, [m]);
  const [seed, setSeed] = useState(1);
  const opts = useMemo(() => ({ starts: bjStartPairs() }), []);
  const { es, one, many, reset } = useEs(m, opts, () => newEs(m, bjPolicy0()), seed);
  const agree = best.filter((a, i) => a >= 0 && es.st.policy[i] === a).length;
  const table = (usable: boolean) => (
    <table className="lab-table bj-policy" aria-label={`Learned policy, ${usable ? "usable ace" : "no usable ace"}: H hit, S stick; cells marked • differ from the exact optimum`}>
      <caption>{usable ? "Usable ace" : "No usable ace"}</caption>
      <thead>
        <tr>
          <th scope="col">sum</th>
          {Array.from({ length: 10 }, (_, d) => (
            <th scope="col" key={d}>
              {d === 0 ? "A" : d + 1}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 10 }, (_, k) => 21 - k).map((sum) => (
          <tr key={sum}>
            <th scope="row">{sum}</th>
            {Array.from({ length: 10 }, (_, d) => {
              const i = bjIndex(sum, d + 1, usable);
              const a = es.st.policy[i];
              const off = a !== best[i];
              return (
                <td key={d} className={`${a === STICK ? "stick" : "hit"}${off ? " off" : ""}`} aria-label={`sum ${sum}, dealer ${d === 0 ? "ace" : d + 1}: ${a === STICK ? "stick" : "hit"}${off ? ", differs from the optimum" : ""}`}>
                  {a === STICK ? "S" : "H"}
                  {off ? "•" : ""}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <>
      <p className="muted small">
        As in Example 5.3: each episode starts from a player state (sum 12–21, the dealer's card, usable ace or not) and a first action, all equally likely; the policy starts as "stick only on 20 or 21" and Q at 0. Every
        blackjack game ends, so every episode is a complete sample. The table marks with • each state where the learned policy differs from the exact optimum, computed by value iteration on the same model; that
        optimum matches the draft's Figure 5.5, including its "notch" (stick from 19 against a dealer ace with a usable ace).
      </p>
      <div className="inputs">
        <label>
          Seed <NumberInput label="seed for Monte Carlo ES on blackjack" value={seed} integer onChange={setSeed} />
        </label>
      </div>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={one}>
          One episode
        </button>
        <button type="button" className="btn" onClick={() => many(10_000)}>
          +10,000 episodes
        </button>
        <button type="button" className="btn" onClick={() => many(500_000)}>
          +500,000 episodes
        </button>
        <button type="button" className="btn" onClick={reset}>
          Reset
        </button>
      </div>
      <p role="status">
        {es.episodes.toLocaleString("en")} episode{es.episodes === 1 ? "" : "s"} · learned policy optimal in {agree} of 200 states
      </p>
      {es.last && (
        <div className="muted small">
          <p>
            Last episode: {es.last.steps.map((x) => `${bjName(x.s)} → ${m.actions[x.a]}`).join("; ")}; reward {f(es.last.steps.at(-1)?.r ?? 0, 0)}.
          </p>
          <ul className="list">
            {es.last.updates.map((u) => (
              <li key={`${u.s},${u.a}`}>
                Q({bjName(u.s)}, {m.actions[u.a]}) ← {f(u.before)} + (1/{es.st.N[u.s][u.a]})·({f(u.G, 0)} − {f(u.before)}) = {f(u.after)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="bj-tables">
        {table(true)}
        {table(false)}
      </div>
      <p className="muted small">Close decisions are slow to settle: the values of hitting and sticking differ by under 0.1 in many states (by 0.0025 for sum 12 against a dealer 4), and each Q(s, a) still averages returns earned under earlier, worse policies.</p>
    </>
  );
}

function EsGrid() {
  const g = useMemo(() => gridworld4x4(), []);
  const optimal = useMemo(() => valueIteration(g, 1).policy.ties, [g]);
  const [seed, setSeed] = useState(7);
  const opts = useMemo(() => ({ maxSteps: GRID_CUT }), []);
  const { es, one, many, reset } = useEs(g, opts, () => newEs(g), seed);
  const [sel, setSel] = useState(1);
  const isOptimal = es.st.policy.every((a, s) => g.terminal[s] || optimal[s].includes(a));
  const cells = Array.from({ length: 16 }, (_, c) => (c === 0 || c === 15 ? [] : [es.st.policy[c]]));
  return (
    <>
      <p className="muted small">
        The draft assumes every episode ends (p. 122) and warns that Monte Carlo methods cannot easily be used when termination is not guaranteed (p. 157). Here a greedy policy can walk into a wall for ever. An
        episode still running after {GRID_CUT} steps is cut off and <strong>discarded</strong>: it is not a sample of the return, so it changes neither Q nor π. Watch how many episodes are lost and how the policy can
        stop improving: that is the reason the draft's example for Monte Carlo ES is blackjack.
      </p>
      <div className="inputs">
        <label>
          Seed <NumberInput label="seed for Monte Carlo ES" value={seed} integer onChange={setSeed} />
        </label>
      </div>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={one}>
          One episode
        </button>
        <button type="button" className="btn" onClick={() => many(1000)}>
          +1000 episodes
        </button>
        <button type="button" className="btn" onClick={reset}>
          Reset
        </button>
      </div>
      <p role="status">
        {es.episodes} episode{es.episodes === 1 ? "" : "s"} · {es.truncated} cut off at {GRID_CUT} steps and discarded · greedy policy {isOptimal ? "is optimal (every arrow is one of the optimal actions)" : "is not optimal"}
      </p>
      {es.last && (
        <p className="muted small">
          Last episode: started with {g.states[es.last.steps[0]?.s ?? 0]}, {g.actions[es.last.steps[0]?.a ?? 0]}; {es.last.steps.length} steps
          {es.last.truncated ? " (cut off and discarded)" : `; return from the start ${f(returnsOf(es.last.steps, 1)[0] ?? 0, 0)}`}.
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
    </>
  );
}

export function McLab() {
  return (
    <>
      <Prediction />
      <ExploringStarts />
      <ImportanceSampling />
      <Racetrack />
    </>
  );
}
