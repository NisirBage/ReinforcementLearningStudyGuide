// Planning laboratory (Chapter 8). Dyna-Q and prioritized sweeping on the Dyna maze, step by step (Figure 8.6); the
// learning curves of Figure 8.5; the blocking and shortcut mazes with Dyna-Q+ and Exercise 8.4's selection-only bonus
// (Figures 8.7–8.8); prioritized sweeping against Dyna-Q at several resolutions (Example 8.4); full against sample
// backups (Figure 8.13); and trajectory sampling (Figure 8.14, Exercise 8.7). Computation: lib/rl/planning.ts.
import { useMemo, useRef, useState } from "react";
import { makeRng } from "../../domain/random";
import {
  BLOCKING_MAZE, DYNA_MAZE, SHORTCUT_MAZE, backupsUntilOptimal, dynaChanging, dynaEpisodes, dynaStep, greedyArrows, greedyPathLength, mazeEnv, newDynaAgent, prioritizedStep,
  randomTask, sampleBackupError, scaleMaze, shortestPath, trajectorySampling, type DynaAgent, type DynaConfig, type MazeEnv,
} from "../../lib/rl/planning";
import { LineChart } from "../../components/LineChart";
import { NumberInput } from "../../components/NumberInput";

const ARROW = ["↑", "↓", "→", "←"];

function MazeGrid({ env, Q, agent, label }: { env: MazeEnv; Q: number[][]; agent?: number; label: string }) {
  const arrows = greedyArrows(Q);
  const { rows, cols } = env.maze;
  return (
    <table className="track-grid maze-grid" aria-label={label}>
      <tbody>
        {Array.from({ length: rows }, (_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }, (_, c) => {
              const s = r * cols + c;
              const cls = env.wall[s] ? "wall" : s === env.goal ? "finish" : s === env.start ? "startline" : "";
              return (
                <td key={c} className={cls}>
                  {s === agent ? "●" : s === env.goal ? "G" : env.wall[s] ? "" : arrows[s] === null ? (s === env.start ? "S" : "") : ARROW[arrows[s]!]}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------- Dyna-Q / prioritized sweeping, step by step ----------
export function DynaStepper() {
  const env = useMemo(() => mazeEnv(DYNA_MAZE), []);
  const [n, setN] = useState(50);
  const [method, setMethod] = useState<"dyna-q" | "prioritized">("dyna-q");
  const ag = useRef<DynaAgent>(newDynaAgent(env.n));
  const pq = useRef(new Map<string, number>());
  const preds = useRef(Array.from({ length: env.n }, () => new Set<string>()));
  const rng = useRef(makeRng(7));
  const [s, setS] = useState(env.start);
  const [stats, setStats] = useState({ episodes: 0, steps: 0, lastEpisode: 0 });
  const [, force] = useState(0);
  const reset = () => {
    ag.current = newDynaAgent(env.n);
    pq.current = new Map();
    preds.current = Array.from({ length: env.n }, () => new Set<string>());
    rng.current = makeRng(7);
    setS(env.start);
    setStats({ episodes: 0, steps: 0, lastEpisode: 0 });
  };
  const cfg: DynaConfig = { n, alpha: method === "prioritized" ? 1 : 0.1, gamma: 0.95, epsilon: 0.1 };
  const advance = (maxSteps: number, untilEpisodeEnd: boolean) => {
    let cur = s;
    let st = { ...stats };
    let k = 0;
    for (; k < maxSteps; k++) {
      const r = method === "dyna-q" ? dynaStep(env, ag.current, cur, cfg, rng.current) : prioritizedStep(env, ag.current, pq.current, preds.current, cur, { ...cfg, theta: 1e-4 }, rng.current);
      st.steps++;
      if (r.done) {
        st = { episodes: st.episodes + 1, steps: 0, lastEpisode: st.steps };
        cur = env.start;
        if (untilEpisodeEnd) break;
      } else cur = r.next;
    }
    setS(cur);
    setStats(st);
    force((x) => x + 1);
  };
  return (
    <section className="card" aria-labelledby="dq-h">
      <h2 id="dq-h">Dyna-Q on the maze (Example 8.1, Figure 8.6)</h2>
      <p className="muted small">
        The 47-state maze of Figure 8.5: reward +1 for entering G, γ = 0.95, ε = 0.1, ties broken at random. After every real step the agent makes a Q-learning backup, records the transition in its
        model, and then makes n planning backups from random previously experienced pairs. Prioritized sweeping instead backs up the pairs whose values would change most, working back from changes
        (Figure 8.9; α = 1 for it, 0.1 for Dyna-Q). Arrows show the greedy action wherever the action values are not all equal; ● is the agent.
      </p>
      <div className="inputs">
        <label>
          Method{" "}
          <select value={method} onChange={(e) => (setMethod(e.target.value as "dyna-q" | "prioritized"), reset())}>
            <option value="dyna-q">Dyna-Q (Figure 8.4)</option>
            <option value="prioritized">prioritized sweeping (Figure 8.9)</option>
          </select>
        </label>
        <label>
          n{" "}
          <select value={n} onChange={(e) => (setN(Number(e.target.value)), reset())}>
            {[0, 5, 50].map((x) => (
              <option key={x} value={x}>
                {x} planning steps
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary" onClick={() => advance(1, false)}>
          Step
        </button>
        <button type="button" className="btn" onClick={() => advance(10_000, true)}>
          Finish episode
        </button>
        <button type="button" className="btn" onClick={reset}>
          Reset
        </button>
      </div>
      <p className="muted" role="status">
        Episode {stats.episodes + 1}, step {stats.steps}; {ag.current.backups} backups so far{stats.episodes ? `; the last episode took ${stats.lastEpisode} steps (shortest: ${shortestPath(env)})` : ""}.
      </p>
      <MazeGrid env={env} Q={ag.current.Q} agent={s} label="The maze with the greedy action in each state" />
    </section>
  );
}

// ---------- Figure 8.5 ----------
function DynaCurves() {
  const [runs, setRuns] = useState(10);
  const [busy, setBusy] = useState(false);
  const [series, setSeries] = useState<{ label: string; values: number[] }[] | null>(null);
  const go = () => {
    setBusy(true);
    setTimeout(() => {
      const env = mazeEnv(DYNA_MAZE);
      setSeries(
        [0, 5, 50].map((n) => {
          const acc = new Array(50).fill(0);
          for (let r = 0; r < runs; r++) dynaEpisodes(env, { n, alpha: 0.1, gamma: 0.95, epsilon: 0.1 }, 50, makeRng(100 + r)).forEach((x, i) => (acc[i] += x / runs));
          return { label: `${n} planning steps`, values: acc.slice(1) };
        }),
      );
      setBusy(false);
    }, 0);
  };
  return (
    <section className="card" aria-labelledby="dc-h">
      <h2 id="dc-h">Learning curves (Figure 8.5)</h2>
      <p className="muted small">Steps per episode from episode 2 on, averaged over runs (the draft: 30). The first episode, a random walk of about 870 steps on average, is not shown, as in the draft.</p>
      <div className="inputs">
        <label>
          Runs <NumberInput label="number of runs" value={runs} min={1} max={30} integer onChange={setRuns} />
        </label>
        <button type="button" className="btn btn-primary" onClick={go} disabled={busy}>
          {busy ? "Running…" : "Run"}
        </button>
      </div>
      {series && <LineChart title="Steps per episode" series={series} xLabel="Episode" yLabel="steps" format={(x) => x.toFixed(0)} yMin={0} xFrom={2} reference={{ y: 14, label: "shortest path (14)" }} />}
    </section>
  );
}

// ---------- Figures 8.7–8.8 and Exercise 8.4 ----------
function ChangingMaze() {
  const [which, setWhich] = useState<"blocking" | "shortcut">("blocking");
  const [runs, setRuns] = useState(5);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ which: string; series: { label: string; values: number[] }[]; paths: string[] } | null>(null);
  const go = () => {
    setBusy(true);
    setTimeout(() => {
      const mazes = which === "blocking" ? BLOCKING_MAZE : SHORTCUT_MAZE;
      const [change, total] = which === "blocking" ? [1000, 3000] : [3000, 6000];
      const env = mazeEnv(mazes[1]);
      const short = shortestPath(env);
      const base: DynaConfig = { n: 50, alpha: 1, gamma: 0.95, epsilon: 0.1 };
      const agents: [string, Partial<DynaConfig>][] = [["Dyna-Q", {}], ["Dyna-Q+", { kappa: 1e-3 }], ["bonus in selection only (Ex. 8.4)", { kappa: 1e-3, bonusIn: "selection" }]];
      const paths: string[] = [];
      const series = agents.map(([label, extra]) => {
        const acc = new Array(total).fill(0);
        let best = 0;
        for (let r = 0; r < runs; r++) {
          const ag = newDynaAgent(env.n);
          dynaChanging(mazes, change, total, { ...base, ...extra }, makeRng(r + 1), ag).forEach((x, i) => (acc[i] += x / runs));
          if (greedyPathLength(env, ag.Q) === short) best++;
        }
        paths.push(`${label}: greedy path is the shortest (${short} steps) at the end in ${best} of ${runs} runs`);
        return { label, values: acc.filter((_, i) => i % 20 === 19) };
      });
      setRes({ which, series, paths });
      setBusy(false);
    }, 0);
  };
  return (
    <section className="card" aria-labelledby="cm-h">
      <h2 id="cm-h">When the model is wrong (Examples 8.2–8.3, Exercise 8.4)</h2>
      <p className="muted small">
        The draft does not give the agents' parameters; ours are n = 50, α = 1 (the mazes are deterministic), ε = 0.1, γ = 0.95, κ = 0.001. Dyna-Q+ plans with reward R + κ√τ for a pair untried for τ
        steps, may plan with untried actions, and models those as staying put with reward 0. The third agent (Exercise 8.4) adds κ√τ only when choosing its real action. Dyna-AC (an actor–critic
        agent, §11.1) is not reproduced.
      </p>
      <div className="inputs">
        <label>
          Maze{" "}
          <select value={which} onChange={(e) => setWhich(e.target.value as "blocking" | "shortcut")} disabled={busy}>
            <option value="blocking">blocking maze (Figure 8.7): path blocked after 1000 steps</option>
            <option value="shortcut">shortcut maze (Figure 8.8): shortcut opens after 3000 steps</option>
          </select>
        </label>
        <label>
          Runs <NumberInput label="number of runs" value={runs} min={1} max={30} integer onChange={setRuns} />
        </label>
        <button type="button" className="btn btn-primary" onClick={go} disabled={busy}>
          {busy ? "Running…" : "Run"}
        </button>
      </div>
      {res && (
        <>
          <LineChart title={`Cumulative reward, ${res.which} maze`} series={res.series} xLabel="Time step (×20)" yLabel="reward" format={(x) => x.toFixed(0)} yMin={0} />
          <ul className="small">
            {res.paths.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// ---------- Example 8.4 ----------
function Sweeping() {
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<{ k: number; states: number; dyna: number; ps: number }[] | null>(null);
  const go = () => {
    setBusy(true);
    setTimeout(() => {
      const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[1];
      setRows(
        [1, 3].map((k) => {
          const m = scaleMaze(DYNA_MAZE, k);
          const cfg = { n: 5, alpha: 1, gamma: 0.95, epsilon: 0.1, theta: 1e-4 };
          return {
            k,
            states: mazeEnv(m).openStates,
            dyna: med([1, 2, 3].map((r) => backupsUntilOptimal(m, "dyna-q", cfg, makeRng(r)))),
            ps: med([1, 2, 3].map((r) => backupsUntilOptimal(m, "prioritized", cfg, makeRng(r)))),
          };
        }),
      );
      setBusy(false);
    }, 0);
  };
  return (
    <section className="card" aria-labelledby="ps-h">
      <h2 id="ps-h">Prioritized sweeping on mazes (Example 8.4)</h2>
      <p className="muted small">
        Backups made until the greedy policy follows a shortest path (checked after each episode), with at most n = 5 backups per real step, α = 1, ε = 0.1, θ = 0.0001; the median of 3 runs. The
        maze is the Dyna maze, and the same maze with every cell split into 3 × 3.
      </p>
      <button type="button" className="btn btn-primary" onClick={go} disabled={busy}>
        {busy ? "Running…" : "Run"}
      </button>
      {rows && (
        <table className="lab-table">
          <caption>Backups until the greedy policy is optimal</caption>
          <thead>
            <tr>
              <th scope="col">states</th>
              <th scope="col">Dyna-Q</th>
              <th scope="col">prioritized sweeping</th>
              <th scope="col">ratio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k}>
                <td>{r.states}</td>
                <td>{r.dyna}</td>
                <td>{r.ps}</td>
                <td>{(r.dyna / r.ps).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ---------- Figure 8.13 ----------
function FullVsSample() {
  const bs = [2, 10, 100, 1000, 10_000];
  const xs = Array.from({ length: 41 }, (_, i) => i / 20); // computations, in units of b
  const series = [
    ...bs.map((b) => ({ label: `sample, b = ${b}`, values: xs.map((x) => sampleBackupError(b, Math.floor(x * b))) })),
    { label: "full backup (any b)", values: xs.map((x) => (x < 1 ? 1 : 0)) },
  ];
  return (
    <section className="card" aria-labelledby="fs-h">
      <h2 id="fs-h">Full against sample backups (Figure 8.13)</h2>
      <p className="muted small">
        One state–action pair with b equally likely successors whose values are correct, initial error 1. A full backup costs b successor evaluations and removes the error when it finishes; t sample
        backups (averaging) leave √((b − 1)/(b t)). For large b a small fraction of b sample backups already removes most of the error.
      </p>
      <LineChart title="RMS error against computation" series={series} xLabel="Computations (in units of b)" yLabel="error" format={(x) => x.toFixed(2)} yMin={0} yMax={1} xLabels={xs.map((x) => `${x}b`)} />
    </section>
  );
}

// ---------- Figure 8.14 and Exercise 8.7 ----------
function TrajectorySampling() {
  const [states, setStates] = useState(1000);
  const [b, setB] = useState(1);
  const [tasks, setTasks] = useState(3);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [res, setRes] = useState<{ title: string; series: { label: string; values: number[] }[]; every: number } | null>(null);
  const go = () => {
    setBusy(true);
    const total = states >= 10_000 ? 100_000 : 20_000;
    const every = total / 20;
    const acc = { uniform: new Array(21).fill(0), "on-policy": new Array(21).fill(0) };
    let i = 0;
    // One task (both distributions) per timer tick, so the page stays responsive and shows progress.
    const next = () => {
      setProgress(`Task ${i + 1} of ${tasks}…`);
      setTimeout(() => {
        const task = randomTask(states, b, makeRng(1000 + i));
        for (const mode of ["uniform", "on-policy"] as const) trajectorySampling(task, mode, total, every, makeRng(i)).forEach((x, j) => (acc[mode][j] += x / tasks));
        i++;
        if (i < tasks) return next();
        setRes({ title: `${states} states, b = ${b}, ${tasks} tasks`, series: [{ label: "uniform", values: acc.uniform }, { label: "on-policy", values: acc["on-policy"] }], every });
        setProgress("");
        setBusy(false);
      }, 0);
    };
    next();
  };
  return (
    <section className="card" aria-labelledby="ts-h">
      <h2 id="ts-h">Trajectory sampling (Figure 8.14, Exercise 8.7)</h2>
      <p className="muted small">
        Random tasks: two actions per state, each leading to one of b next states (equally likely), with a 0.1 chance on every transition of ending the episode. The draft does not say how rewards
        are set; ours are drawn once per transition from a standard normal. Full backups (8.1) are distributed either by sweeping all pairs in turn (uniform) or along simulated ε-greedy episodes
        (on-policy, ε = 0.1). The measure is the start state's value under the greedy policy, computed exactly. Exercise 8.7: choose 10,000 states and b = 1, then b = 3 (slow: a few seconds per task).
      </p>
      <div className="inputs">
        <label>
          States{" "}
          <select value={states} onChange={(e) => setStates(Number(e.target.value))} disabled={busy}>
            <option value={1000}>1000</option>
            <option value={10_000}>10,000</option>
          </select>
        </label>
        <label>
          b{" "}
          <select value={b} onChange={(e) => setB(Number(e.target.value))} disabled={busy}>
            {[1, 3, 10].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tasks <NumberInput label="number of tasks" value={tasks} min={1} max={50} integer onChange={setTasks} />
        </label>
        <button type="button" className="btn btn-primary" onClick={go} disabled={busy}>
          {busy ? "Running…" : "Run"}
        </button>
      </div>
      {progress && (
        <p className="muted" role="status">
          {progress}
        </p>
      )}
      {res && (
        <LineChart
          title={`Value of the start state under the greedy policy (${res.title})`}
          series={res.series}
          xLabel="Full backups"
          yLabel="value"
          format={(x) => x.toFixed(2)}
          xFrom={0}
          xLabels={res.series[0].values.map((_, i) => String(i * res.every))}
        />
      )}
    </section>
  );
}

export function PlanningLab() {
  return (
    <>
      <DynaStepper />
      <DynaCurves />
      <ChangingMaze />
      <Sweeping />
      <FullVsSample />
      <TrajectorySampling />
    </>
  );
}
