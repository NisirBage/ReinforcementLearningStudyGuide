// Temporal-difference laboratory. Prediction: TD(0) on the random walk, step by step, and against constant-α MC
// (Figures 6.6, 6.7). Control: Sarsa and Q-learning on cliff walking and the windy gridworld (Figures 6.11, 6.13), with
// every quantity of each update shown. Computation: lib/rl/td.ts, lib/rl/mc.ts.
import { useMemo, useRef, useState } from "react";
import { makeRng } from "../../domain/random";
import { equiprobablePolicy } from "../../lib/rl/mdp";
import { runMcPrediction } from "../../lib/rl/mc";
import { sampleAction, sampleStep } from "../../lib/rl/sampling";
import {
  controlStep, greedyPath, maxQ, newControl, rmsError, runControl, runTd0, td0Update, type ControlMethod, type ControlState, type ControlStepDetail, type Td0Detail,
} from "../../lib/rl/td";
import { RANDOM_WALK_START, RANDOM_WALK_TRUE, cliffWalking, randomWalk, windyGridworld, windyVariant, type GridMDP } from "../../lib/rl/envs/examples";
import { valueIteration } from "../../lib/rl/dp";
import { GridView } from "../../components/GridView";
import { LineChart } from "../../components/LineChart";
import { NumberInput } from "../../components/NumberInput";
import { Tex } from "../../components/math";

const f = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "–");
const WALK = ["A", "B", "C", "D", "E"];
const walkName = (s: number) => (s === 0 ? "left end" : s === 6 ? "right end" : WALK[s - 1]);

// ---------- Prediction ----------

export function TdStepper() {
  const rw = useMemo(() => randomWalk(), []);
  const pi = useMemo(() => equiprobablePolicy(rw), [rw]);
  const [alpha, setAlpha] = useState(0.1);
  const [seed, setSeed] = useState(1);
  const rngRef = useRef(makeRng(1));
  const [V, setV] = useState<number[]>(() => [0, 0.5, 0.5, 0.5, 0.5, 0.5, 0]);
  const [s, setS] = useState(RANDOM_WALK_START);
  const [episodes, setEpisodes] = useState(0);
  const [last, setLast] = useState<Td0Detail | null>(null);
  const reset = (sd = seed) => {
    rngRef.current = makeRng(sd);
    setV([0, 0.5, 0.5, 0.5, 0.5, 0.5, 0]);
    setS(RANDOM_WALK_START);
    setEpisodes(0);
    setLast(null);
  };
  const step = (n: number) => {
    const v = [...V];
    let cur = s;
    let eps = episodes;
    let d: Td0Detail | null = last;
    for (let i = 0; i < n; i++) {
      const a = sampleAction(pi, cur, rngRef.current);
      const { next, reward } = sampleStep(rw, cur, a, rngRef.current);
      d = td0Update(v, rw, cur, reward, next, alpha, 1);
      cur = rw.terminal[next] ? RANDOM_WALK_START : next;
      if (rw.terminal[next]) eps++;
    }
    setV(v);
    setS(cur);
    setEpisodes(eps);
    setLast(d);
  };
  const runEpisodes = (n: number) => {
    // Runs n more episodes from the current state of the walk (an unfinished episode is completed first).
    const v = [...V];
    let cur = s;
    let eps = episodes;
    let d: Td0Detail | null = last;
    const target = eps + n;
    while (eps < target) {
      const a = sampleAction(pi, cur, rngRef.current);
      const { next, reward } = sampleStep(rw, cur, a, rngRef.current);
      d = td0Update(v, rw, cur, reward, next, alpha, 1);
      cur = rw.terminal[next] ? RANDOM_WALK_START : next;
      if (rw.terminal[next]) eps++;
    }
    setV(v);
    setS(cur);
    setEpisodes(eps);
    setLast(d);
  };
  return (
    <section className="card" aria-labelledby="td0-h">
      <h2 id="td0-h">TD(0), one step at a time (random walk, Example 6.2)</h2>
      <p className="muted small">
        <Tex tex="V(S_t) \leftarrow V(S_t) + \alpha\big[R_{t+1} + \gamma V(S_{t+1}) - V(S_t)\big]" /> (6.2), γ = 1, all estimates starting at 0.5. Episodes start in C and end at either end; only reaching the right end pays +1.
      </p>
      <div className="inputs">
        <label>
          α <NumberInput label="TD step size α" value={alpha} min={0.0001} max={1} onChange={setAlpha} />
        </label>
        <label>
          Seed <NumberInput label="TD seed" value={seed} integer onChange={(x) => (setSeed(x), reset(x))} />
        </label>
      </div>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={() => step(1)}>
          Step
        </button>
        <button type="button" className="btn" onClick={() => runEpisodes(1)}>
          Finish this episode
        </button>
        <button type="button" className="btn" onClick={() => runEpisodes(100)}>
          +100 episodes
        </button>
        <button type="button" className="btn" onClick={() => reset()}>
          Reset
        </button>
      </div>
      <p role="status" className="muted">
        {episodes} episodes finished · now in {walkName(s)} · RMS error {f(rmsError(V, RANDOM_WALK_TRUE, [1, 2, 3, 4, 5]))}
      </p>
      {last && (
        <pre className="calc" aria-live="polite">
          {[
            `S_t = ${walkName(last.s)}, R_t+1 = ${last.r}, S_t+1 = ${walkName(last.next)}`,
            `V(S_t) = ${f(last.vS)}, V(S_t+1) = ${f(last.vNext)}${last.next === 0 || last.next === 6 ? " (terminal: 0)" : ""}`,
            `TD target = R + γ V(S_t+1) = ${last.r} + 1 · ${f(last.vNext)} = ${f(last.target)}`,
            `TD error δ = target − V(S_t) = ${f(last.target)} − ${f(last.vS)} = ${f(last.delta)}`,
            `V(S_t) ← ${f(last.vS)} + ${alpha} · ${f(last.delta)} = ${f(last.after)}`,
          ].join("\n")}
        </pre>
      )}
      <table className="lab-table">
        <thead>
          <tr>
            <th scope="col">state</th>
            {WALK.map((x) => (
              <th key={x} scope="col">
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>V</td>
            {[1, 2, 3, 4, 5].map((i) => (
              <td key={i} className={`num ${s === i ? "best" : ""}`}>
                {f(V[i])}
              </td>
            ))}
          </tr>
          <tr>
            <td>true</td>
            {[1, 2, 3, 4, 5].map((i) => (
              <td key={i} className="num">
                {i}/6
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function TdVsMc() {
  const rw = useMemo(() => randomWalk(), []);
  const pi = useMemo(() => equiprobablePolicy(rw), [rw]);
  const [res, setRes] = useState<{ label: string; values: number[] }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const series = [
    { label: "TD α=0.05", run: (seed: number) => runTd0(rw, pi, RANDOM_WALK_START, 0.05, 1, 100, makeRng(seed), 0.5).history },
    { label: "TD α=0.1", run: (seed: number) => runTd0(rw, pi, RANDOM_WALK_START, 0.1, 1, 100, makeRng(seed), 0.5).history },
    { label: "MC α=0.02", run: (seed: number) => runMcPrediction(rw, pi, RANDOM_WALK_START, 1, 100, makeRng(1000 + seed), { alpha: 0.02, v0: 0.5, firstVisit: false }).history },
    { label: "MC α=0.04", run: (seed: number) => runMcPrediction(rw, pi, RANDOM_WALK_START, 1, 100, makeRng(1000 + seed), { alpha: 0.04, v0: 0.5, firstVisit: false }).history },
  ];
  const go = () => {
    setBusy(true);
    setTimeout(() => {
      const out = series.map((sr) => {
        const acc = new Array(101).fill(0);
        for (let r = 1; r <= 100; r++) sr.run(r).forEach((v, i) => (acc[i] += rmsError(v, RANDOM_WALK_TRUE, [1, 2, 3, 4, 5]) / 100));
        return { label: sr.label, values: acc };
      });
      setRes(out);
      setBusy(false);
    }, 0);
  };
  const fig66 = useMemo(() => {
    const h = runTd0(rw, pi, RANDOM_WALK_START, 0.1, 1, 100, makeRng(3), 0.5).history;
    return [0, 1, 10, 100].map((k) => ({ label: `after ${k}`, values: [1, 2, 3, 4, 5].map((s) => h[k][s]) }));
  }, [rw, pi]);
  return (
    <section className="card" aria-labelledby="cmp-h">
      <h2 id="cmp-h">TD(0) against constant-α Monte Carlo (Figures 6.6 and 6.7)</h2>
      <LineChart title="TD(0) estimates of A–E after 0, 1, 10 and 100 episodes (α = 0.1)" series={fig66} xLabel="State (1 = A … 5 = E)" yLabel="estimated value" format={(x) => x.toFixed(2)} yMin={0} yMax={1} />
      <p className="muted small">True values: 1/6, 2/6, 3/6, 4/6, 5/6. With a constant α the final estimates keep fluctuating with the latest episodes (Figure 6.6's caption).</p>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={go} disabled={busy}>
          {busy ? "Running 100 sequences…" : "Average 100 sequences of 100 episodes"}
        </button>
      </div>
      {res && (
        <LineChart
          title="RMS error averaged over the five states and 100 sequences"
          series={res}
          xLabel="Episodes"
          yLabel="RMS error"
          format={(x) => x.toFixed(3)}
          yMin={0}
          xFrom={0}
          reference={{ y: Math.sqrt(1 / 18), label: "start: √(1/18) ≈ 0.236" }}
        />
      )}
    </section>
  );
}

// ---------- Control ----------

type Task = "cliff" | "windy";
const taskOf = (t: Task): GridMDP => (t === "cliff" ? cliffWalking() : windyGridworld());
/** The comparison panel also runs the windy gridworld of Exercises 6.6–6.7 (king's moves, "stay", stochastic wind). */
type CompareTask = Task | "king" | "king-stay" | "king-stochastic";
const compareTaskOf = (t: CompareTask): GridMDP =>
  t === "king" ? windyVariant() : t === "king-stay" ? windyVariant({ stay: true }) : t === "king-stochastic" ? windyVariant({ stochastic: true }) : taskOf(t);

function Explain({ d, m, alpha, gamma }: { d: ControlStepDetail; m: GridMDP; alpha: number; gamma: number }) {
  const cell = (s: number) => `(${Math.floor(s / m.grid.cols) + 1},${(s % m.grid.cols) + 1})`;
  const A = (a: number) => m.actions[a];
  const boot =
    d.method === "sarsa"
      ? d.terminal
        ? "Q(S_t+1, A_t+1) = 0 (terminal)"
        : `Q(S_t+1, A_t+1) = Q(${cell(d.next)}, ${A(d.nextAction!)}) = ${f(d.bootstrap)}`
      : d.terminal
        ? "max_a Q(S_t+1, a) = 0 (terminal)"
        : `max_a Q(S_t+1, a) = ${f(d.bootstrap)}`;
  return (
    <pre className="calc" aria-live="polite">
      {[
        `S_t = ${cell(d.s)}   A_t = ${A(d.a)}${d.explored ? " (ε: random)" : " (greedy)"}`,
        `R_t+1 = ${d.r}   S_t+1 = ${cell(d.next)}${d.terminal ? " (goal)" : ""}${d.method === "sarsa" && d.nextAction !== null ? `   A_t+1 = ${A(d.nextAction)}` : ""}`,
        `Q(S_t, A_t) = ${f(d.qSA)}`,
        boot,
        `TD target = R_t+1 + γ · ${d.method === "sarsa" ? "Q(S_t+1, A_t+1)" : "max_a Q(S_t+1, a)"} = ${d.r} + ${gamma} · ${f(d.bootstrap)} = ${f(d.target)}`,
        `TD error δ = target − Q(S_t, A_t) = ${f(d.target)} − ${f(d.qSA)} = ${f(d.delta)}`,
        `Q(S_t, A_t) ← ${f(d.qSA)} + ${alpha} · ${f(d.delta)} = ${f(d.after)}`,
      ].join("\n")}
    </pre>
  );
}

export function ControlInspector({ initialMethod = "q-learning" }: { initialMethod?: ControlMethod } = {}) {
  const [task, setTask] = useState<Task>("cliff");
  const [method, setMethod] = useState<ControlMethod>(initialMethod);
  const [alpha, setAlpha] = useState(0.5);
  const [epsilon, setEpsilon] = useState(0.1);
  const [seed, setSeed] = useState(1);
  const m = useMemo(() => taskOf(task), [task]);
  const rngRef = useRef(makeRng(1));
  const [st, setSt] = useState<ControlState>(() => newControl(m, m.grid.start));
  const [last, setLast] = useState<ControlStepDetail | null>(null);
  const [returns, setReturns] = useState<number[]>([]);
  const cfg = { method, alpha, epsilon, gamma: 1 };
  const reset = (mm = m, sd = seed) => {
    rngRef.current = makeRng(sd);
    setSt(newControl(mm, mm.grid.start));
    setLast(null);
    setReturns([]);
  };
  const advance = (cond: (out: { done: boolean }, i: number) => boolean, cap = 200_000) => {
    let s = st;
    let d = last;
    const rets = [...returns];
    for (let i = 0; i < cap; i++) {
      const out = controlStep(m, s, cfg, rngRef.current, m.grid.start) as ReturnType<typeof controlStep> & { episodeReturn: number };
      s = out.state;
      d = out.detail;
      if (out.done) rets.push(out.episodeReturn);
      if (cond(out, i)) break;
    }
    setSt(s);
    setLast(d);
    setReturns(rets);
  };
  const greedy = m.states.map((_, s) => {
    if (m.terminal[s]) return [];
    const best = maxQ(st.Q, m, s);
    return m.actions.map((_, a) => a).filter((a) => st.Q[s][a] === best && best !== 0);
  });
  const path = greedyPath(m, st.Q, m.grid.start) ?? [];
  return (
    <section className="card" aria-labelledby="ctl-h">
      <h2 id="ctl-h">Sarsa and Q-learning, one update at a time</h2>
      <div className="inputs">
        <label>
          Task{" "}
          <select
            value={task}
            onChange={(e) => {
              const t = e.target.value as Task;
              setTask(t);
              reset(taskOf(t));
            }}
          >
            <option value="cliff">cliff walking (Example 6.6)</option>
            <option value="windy">windy gridworld (Example 6.5)</option>
          </select>
        </label>
        <label>
          Method{" "}
          <select value={method} onChange={(e) => (setMethod(e.target.value as ControlMethod), reset())}>
            <option value="sarsa">Sarsa (6.5), on-policy</option>
            <option value="q-learning">Q-learning (6.6), off-policy</option>
          </select>
        </label>
        <label>
          α <NumberInput label="control step size α" value={alpha} min={0.0001} max={1} onChange={setAlpha} />
        </label>
        <label>
          ε <NumberInput label="exploration ε" value={epsilon} min={0} max={1} onChange={setEpsilon} />
        </label>
        <label>
          Seed <NumberInput label="control seed" value={seed} integer onChange={(x) => (setSeed(x), reset(m, x))} />
        </label>
      </div>
      <p className="muted small">
        Reward −1 per step{task === "cliff" ? "; stepping into the cliff gives −100 and returns the agent to S (the episode goes on)" : "; the wind (numbers under the columns) pushes the agent up"}. Q starts at 0; γ = 1.
        {task === "cliff" ? " The draft gives ε = 0.1 for Figure 6.13 but not α; α = 0.5 is the app's choice." : " Figure 6.11 uses ε = 0.1, α = 0.5."}
      </p>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={() => advance(() => true)}>
          Step
        </button>
        <button type="button" className="btn" onClick={() => advance((_, i) => i >= 9)}>
          +10 steps
        </button>
        <button type="button" className="btn" onClick={() => advance((o) => o.done)}>
          Finish the episode
        </button>
        <button type="button" className="btn" onClick={() => {
          let n = 0;
          advance((o) => o.done && ++n >= 50);
        }}>
          +50 episodes
        </button>
        <button type="button" className="btn" onClick={() => reset()}>
          Reset
        </button>
      </div>
      <p role="status" className="muted">
        Step {st.totalSteps} · episode {st.episode + 1} · {returns.length ? `last episode's reward ${returns.at(-1)}` : "no episode finished yet"} · greedy path from S: {path.length ? `${path.length - 1} steps` : "loops or not learned yet"}
      </p>
      {last ? <Explain d={last} m={m} alpha={alpha} gamma={1} /> : <p className="muted">Press Step: the agent takes one action and one update is made.</p>}
      <GridView
        rows={m.grid.rows}
        cols={m.grid.cols}
        stateAt={(r, c) => r * m.grid.cols + c}
        label="Agent, greedy actions and max_a Q"
        values={m.states.map((_, s) => (m.terminal[s] ? NaN : maxQ(st.Q, m, s)))}
        arrows={greedy}
        agent={st.s}
        start={m.grid.start}
        goals={m.grid.goal}
        terminal={m.terminal}
        cliff={m.grid.cliff}
        wind={m.grid.wind}
        path={path}
        digits={0}
      />
      <p className="muted small">Each cell shows max_a Q(s, a) and its greedy action(s); the outlined cells are the greedy path from S; the filled cell is the agent.</p>
    </section>
  );
}

function Compare() {
  const [task, setTask] = useState<CompareTask>("cliff");
  const [runs, setRuns] = useState(20);
  const [res, setRes] = useState<{ task: CompareTask; series: { label: string; values: number[] }[]; paths: string[]; optimum?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const go = () => {
    setBusy(true);
    setTimeout(() => {
      const m = compareTaskOf(task);
      const methods: ControlMethod[] = ["sarsa", "q-learning"];
      const paths: string[] = [];
      const series = methods.map((method) => {
        if (task === "cliff") {
          const acc = new Array(500).fill(0);
          let lens: number[] = [];
          for (let r = 1; r <= runs; r++) {
            const out = runControl(m, m.grid.start, { method, alpha: 0.5, epsilon: 0.1, gamma: 1 }, makeRng(r), { episodes: 500 });
            out.rewards.forEach((x, i) => (acc[i] += x / runs));
            lens.push((greedyPath(m, out.Q, m.grid.start) ?? []).length - 1);
          }
          lens = lens.filter((x) => x > 0);
          paths.push(`${method === "sarsa" ? "Sarsa" : "Q-learning"}: greedy path ${lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : "–"} steps on average`);
          // A 10-episode moving average, as the draft's single run is smoothed.
          return { label: method === "sarsa" ? "Sarsa" : "Q-learning", values: acc.map((_, i) => acc.slice(Math.max(0, i - 9), i + 1).reduce((a, b) => a + b, 0) / Math.min(10, i + 1)) };
        }
        const T = 8000;
        const acc = new Array(T).fill(0);
        for (let r = 1; r <= runs; r++) {
          const out = runControl(m, m.grid.start, { method, alpha: 0.5, epsilon: 0.1, gamma: 1 }, makeRng(r), { maxTotalSteps: T });
          let k = 0;
          for (let t = 0; t < T; t++) {
            while (k < out.endedAt.length && out.endedAt[k] <= t + 1) k++;
            acc[t] += k / runs;
          }
        }
        paths.push(`${method === "sarsa" ? "Sarsa" : "Q-learning"}: ${acc[T - 1].toFixed(0)} episodes by step ${T} (average)`);
        return { label: method === "sarsa" ? "Sarsa" : "Q-learning", values: acc };
      });
      // Windy tasks: the optimal expected number of steps from S, by value iteration on the exact model.
      const optimum = task === "cliff" ? undefined : -valueIteration(m, 1, { theta: 1e-10 }).v[m.grid.start];
      setRes({ task, series, paths, optimum });
      setBusy(false);
    }, 0);
  };
  return (
    <section className="card" aria-labelledby="cmp2-h">
      <h2 id="cmp2-h">Compare Sarsa and Q-learning (ε = 0.1, α = 0.5)</h2>
      <div className="inputs">
        <label>
          Task{" "}
          <select value={task} onChange={(e) => setTask(e.target.value as CompareTask)}>
            <option value="cliff">cliff walking: reward per episode (Figure 6.13)</option>
            <option value="windy">windy gridworld: episodes completed against time steps (Figure 6.11)</option>
            <option value="king">windy gridworld, king's moves (Exercise 6.6)</option>
            <option value="king-stay">windy gridworld, king's moves and "stay" (Exercise 6.6)</option>
            <option value="king-stochastic">windy gridworld, king's moves, stochastic wind (Exercise 6.7)</option>
          </select>
        </label>
        <label>
          Runs <NumberInput label="number of runs" value={runs} min={1} max={100} integer onChange={setRuns} />
        </label>
        <button type="button" className="btn btn-primary" onClick={go} disabled={busy}>
          {busy ? "Running…" : "Run"}
        </button>
      </div>
      {res && res.task === "cliff" && (
        <LineChart title={`Reward per episode (average of ${runs} runs, 10-episode moving average)`} series={res.series} xLabel="Episode" yLabel="sum of rewards" format={(x) => x.toFixed(0)} yMin={-100} yMax={0} />
      )}
      {res && res.task !== "cliff" && <LineChart title={`Episodes completed (average of ${runs} runs)`} series={res.series} xLabel="Time step" yLabel="episodes" format={(x) => x.toFixed(0)} yMin={0} />}
      {res && (
        <ul>
          {res.paths.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {res && res.optimum !== undefined && (
        <p className="muted small">
          Optimal expected episode length from S (value iteration on the exact model): {res.optimum.toFixed(2)} steps. A steeper curve means shorter episodes. Learned episodes stay longer than this optimum, because of ε = 0.1 exploration and learning that is not finished; with stochastic wind and α = 0.5 they are still many times longer after 8000 steps.
        </p>
      )}
      {res && res.task === "cliff" && <p className="muted small">The draft's Figure 6.13 shows Sarsa near −25 and Q-learning near −50: Q-learning learns the optimal path along the edge (13 steps) and sometimes falls while exploring.</p>}
    </section>
  );
}

export function TdLab() {
  return (
    <>
      <TdStepper />
      <TdVsMc />
      <ControlInspector />
      <Compare />
    </>
  );
}
