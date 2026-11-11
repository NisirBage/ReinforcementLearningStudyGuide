// Eligibility-traces laboratory (Chapter 7). TD(λ) step by step with its traces; the three kinds of trace (Figure 7.9)
// and the half-life of λ (Exercise 7.4); the 19-state random-walk experiments of Figures 7.2 and 7.6; and the credit
// that one episode gives with and without traces (Example 7.2, Figure 7.13), with Watkins's cut. Computation:
// lib/rl/traces.ts.
import { useMemo, useRef, useState } from "react";
import { makeRng } from "../../domain/random";
import {
  EXAMPLE_7_2, bumpTrace, halfLife, openGrid, pathFromActions, replayPath, walkExperiment, walkSets, type PredictionMethod, type TraceKind, type Walk,
} from "../../lib/rl/traces";
import { LineChart } from "../../components/LineChart";
import { NumberInput } from "../../components/NumberInput";

const f = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "–");
const WALK = ["A", "B", "C", "D", "E"];
const name = (s: number) => (s === 0 ? "left end" : s === 6 ? "right end" : WALK[s - 1]);

// ---------- TD(λ) on the 5-state random walk, one step at a time (Figure 7.7) ----------
type StepperTrace = TraceKind | "true-online";
export function TdLambdaStepper() {
  const [lambda, setLambda] = useState(0.8);
  const [alpha, setAlpha] = useState(0.1);
  const [kind, setKind] = useState<StepperTrace>("accumulating");
  const rng = useRef(makeRng(1));
  const [V, setV] = useState<number[]>([0, 0.5, 0.5, 0.5, 0.5, 0.5, 0]);
  const [E, setE] = useState<number[]>(new Array(7).fill(0));
  const [s, setS] = useState(3);
  const [vOld, setVOld] = useState(0);
  const [episodes, setEpisodes] = useState(0);
  const [last, setLast] = useState<{ s: number; r: number; s2: number; delta: number; changed: { x: number; by: number }[] } | null>(null);
  const reset = () => {
    rng.current = makeRng(1);
    setV([0, 0.5, 0.5, 0.5, 0.5, 0.5, 0]);
    setE(new Array(7).fill(0));
    setS(3);
    setVOld(0);
    setEpisodes(0);
    setLast(null);
  };
  const step = () => {
    const s2 = rng.current() < 0.5 ? s - 1 : s + 1;
    const r = s2 === 6 ? 1 : 0;
    const v2 = s2 === 0 || s2 === 6 ? 0 : V[s2];
    const delta = r + v2 - V[s]; // γ = 1
    const nV = [...V];
    const nE = [...E];
    const before = [...V];
    if (kind === "true-online") {
      // Figure 7.10
      const D = V[s] - vOld;
      nE[s] = (1 - alpha) * nE[s] + 1;
      for (let x = 1; x <= 5; x++) {
        nV[x] += alpha * (delta + D) * nE[x];
        nE[x] *= lambda;
      }
      nV[s] -= alpha * D;
      setVOld(v2);
    } else {
      nE[s] = bumpTrace(nE[s], kind, alpha);
      for (let x = 1; x <= 5; x++) {
        nV[x] += alpha * delta * nE[x];
        nE[x] *= lambda;
      }
    }
    const done = s2 === 0 || s2 === 6;
    setLast({ s, r, s2, delta, changed: [1, 2, 3, 4, 5].map((x) => ({ x, by: nV[x] - before[x] })).filter((c) => Math.abs(c.by) > 1e-12) });
    setV(nV);
    setE(done ? new Array(7).fill(0) : nE);
    if (done) {
      setS(3);
      setVOld(0);
      setEpisodes((e) => e + 1);
    } else setS(s2);
  };
  return (
    <section className="card" aria-labelledby="tdl-h">
      <h2 id="tdl-h">TD(λ) step by step (Figure 7.7)</h2>
      <p className="muted small">
        The 5-state random walk of Example 6.2 (γ = 1, values start at 0.5). Each step computes the one TD error δ and sends it back to every state in proportion to its eligibility trace; then all
        traces decay by γλ. Traces are shown after the decay, ready for the next step.
      </p>
      <div className="inputs">
        <label>
          λ <NumberInput label="trace-decay parameter lambda" value={lambda} min={0} max={1} onChange={setLambda} />
        </label>
        <label>
          α <NumberInput label="step size alpha" value={alpha} min={0} max={1} onChange={setAlpha} />
        </label>
        <label>
          Trace{" "}
          <select value={kind} onChange={(e) => (setKind(e.target.value as StepperTrace), reset())}>
            <option value="accumulating">accumulating (7.9)</option>
            <option value="replacing">replacing (7.12)</option>
            <option value="dutch">dutch (7.13)</option>
            <option value="true-online">true on-line TD(λ) (Figure 7.10)</option>
          </select>
        </label>
        <button type="button" className="btn btn-primary" onClick={step}>
          Step
        </button>
        <button type="button" className="btn" onClick={reset}>
          Reset
        </button>
      </div>
      <p className="muted">
        Now at {name(s)}; {episodes} episodes finished.
      </p>
      {last && (
        <p>
          {name(last.s)} → {name(last.s2)}, reward {last.r}: δ = {last.r} + V({name(last.s2)}) − V({name(last.s)}) = {f(last.delta)}.{" "}
          {last.changed.length ? `Changed: ${last.changed.map((c) => `${name(c.x)} by ${f(c.by, 4)}`).join(", ")}.` : "No value changed (δ = 0)."}
        </p>
      )}
      <table className="lab-table">
        <caption>Values and eligibility traces of the random walk's states</caption>
        <thead>
          <tr>
            <th scope="col">state</th>
            {WALK.map((w) => (
              <th key={w} scope="col">
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">V</th>
            {[1, 2, 3, 4, 5].map((x) => (
              <td key={x}>{f(V[x])}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">E</th>
            {[1, 2, 3, 4, 5].map((x) => (
              <td key={x}>{f(E[x])}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  );
}

// ---------- The three traces (Figure 7.9) and the half-life (Exercise 7.4) ----------
function TraceTypes() {
  const [gl, setGl] = useState(0.8);
  const [alpha, setAlpha] = useState(0.5);
  const visits = useMemo(() => new Set([2, 9, 10, 11, 12]), []);
  const series = (["accumulating", "dutch", "replacing"] as TraceKind[]).map((kind) => {
    let e = 0;
    return { label: kind === "dutch" ? `dutch (α = ${alpha})` : kind, values: Array.from({ length: 25 }, (_, t) => (e = visits.has(t) ? bumpTrace(gl * e, kind, alpha) : gl * e)) };
  });
  const lambda = gl;
  return (
    <section className="card" aria-labelledby="tt-h">
      <h2 id="tt-h">Three kinds of trace (Figure 7.9)</h2>
      <p className="muted small">One state, visited at steps 2, 9, 10, 11 and 12. Every trace decays by γλ per step; they differ only at a visit: +1 (accumulating), reset to 1 (replacing), or (1 − α)·(decayed trace) + 1 (dutch).</p>
      <div className="inputs">
        <label>
          γλ <NumberInput label="decay gamma times lambda" value={gl} min={0} max={1} onChange={setGl} />
        </label>
        <label>
          α (dutch) <NumberInput label="dutch trace step size" value={alpha} min={0} max={1} onChange={setAlpha} />
        </label>
      </div>
      <LineChart title="Eligibility trace of one state" series={series} xLabel="Time step" yLabel="trace" format={(x) => x.toFixed(2)} yMin={0} xFrom={0} />
      <p className="muted small">
        Exercise 7.4: the weights λ^n fall to half after τ = ln(1/2)/ln λ steps; for λ = {f(lambda, 2)}, τ = {lambda > 0 && lambda < 1 ? f(halfLife(lambda), 2) : "–"} steps.
      </p>
    </section>
  );
}

// ---------- Figures 7.2 and 7.6 ----------
type Family = "n-online" | "n-offline" | "lr-online" | "lr-offline" | "acc" | "dutch" | "repl" | "true-online";
const FAMILIES: Record<Family, string> = {
  "n-online": "on-line n-step TD (Figure 7.2, left)",
  "n-offline": "off-line n-step TD (Figure 7.2, right)",
  "lr-online": "on-line λ-return algorithm",
  "lr-offline": "off-line λ-return (= off-line TD(λ), accumulating)",
  acc: "on-line TD(λ), accumulating traces",
  dutch: "on-line TD(λ), dutch traces",
  repl: "on-line TD(λ), replacing traces",
  "true-online": "true on-line TD(λ)",
};
const NS = [1, 2, 4, 8, 16, 32, 64];
const LAMBDAS = [0, 0.4, 0.8, 0.9, 0.95, 0.975, 0.99, 1];
const ALPHAS = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
function methodOf(fam: Family, p: number): PredictionMethod {
  if (fam === "n-online" || fam === "n-offline") return { kind: "n-step", n: p, mode: fam === "n-online" ? "online" : "offline" };
  if (fam === "lr-online" || fam === "lr-offline") return { kind: "lambda-return", lambda: p, mode: fam === "lr-online" ? "online" : "offline" };
  if (fam === "true-online") return { kind: "true-online", lambda: p };
  return { kind: "td-lambda", lambda: p, trace: fam === "acc" ? "accumulating" : fam === "dutch" ? "dutch" : "replacing", mode: "online" };
}
function WalkExperiment() {
  const [fam, setFam] = useState<Family>("n-online");
  const [runs, setRuns] = useState(20);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ fam: Family; runs: number; series: { label: string; values: number[] }[]; best: string } | null>(null);
  const go = () => {
    setBusy(true);
    setTimeout(() => {
      const sets: Walk[][] = walkSets(runs, 10, makeRng(1));
      const params = fam.startsWith("n-") ? NS : LAMBDAS;
      let best = { e: Infinity, label: "" };
      const series = params.map((p) => {
        const label = fam.startsWith("n-") ? `n = ${p}` : `λ = ${p}`;
        const values = ALPHAS.map((a) => {
          const e = walkExperiment(methodOf(fam, p), a, sets); // α = 0: the values stay at 0 (error ≈ 0.548)
          if (a > 0 && e < best.e) best = { e, label: `${label}, α = ${a}` };
          return e > 0.55 ? NaN : e;
        });
        return { label, values };
      });
      setRes({ fam, runs, series, best: `${best.label}: ${best.e.toFixed(3)}` });
      setBusy(false);
    }, 0);
  };
  return (
    <section className="card" aria-labelledby="rw-h">
      <h2 id="rw-h">19-state random walk (Example 7.1, Figures 7.2 and 7.6)</h2>
      <p className="muted small">
        19 states, −1 for leaving on the left, +1 on the right, γ = 1, values start at 0. The measure is the RMS error over the 19 states at the end of each of the first 10 episodes, averaged
        over the episodes and the runs; every method sees the same walks. Errors above 0.55 leave the plot, as in the draft. The draft used 100 runs; fewer runs are quicker and noisier.
      </p>
      <div className="inputs">
        <label>
          Method{" "}
          <select value={fam} onChange={(e) => setFam(e.target.value as Family)} disabled={busy}>
            {(Object.keys(FAMILIES) as Family[]).map((k) => (
              <option key={k} value={k}>
                {FAMILIES[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Runs <NumberInput label="number of runs" value={runs} min={1} max={100} integer onChange={setRuns} />
        </label>
        <button type="button" className="btn btn-primary" onClick={go} disabled={busy}>
          {busy ? "Running…" : "Run"}
        </button>
      </div>
      {res && (
        <>
          <LineChart
            title={`${FAMILIES[res.fam]}: RMS error over the first 10 episodes (${res.runs} runs)`}
            series={res.series}
            xLabel="α"
            yLabel="RMS error"
            format={(x) => x.toFixed(3)}
            yMin={0.2}
            yMax={0.55}
            xLabels={ALPHAS.map(String)}
          />
          <p className="muted small">Best setting: {res.best}.</p>
        </>
      )}
    </section>
  );
}

// ---------- Example 7.2 ----------
export function PathCredit() {
  const g = useMemo(() => openGrid(EXAMPLE_7_2.rows, EXAMPLE_7_2.cols, EXAMPLE_7_2.goal), []);
  const { path, final } = useMemo(() => pathFromActions(g, EXAMPLE_7_2.start, EXAMPLE_7_2.actions), [g]);
  const [lambda, setLambda] = useState(0.9);
  const [cut, setCut] = useState(0);
  const alpha = 0.1;
  const Q = useMemo(() => replayPath(g, path, final, 1, lambda, alpha, 1, "accumulating", cut > 0 ? cut : undefined), [g, path, final, lambda, cut]);
  const one = useMemo(() => replayPath(g, path, final, 1, 0, alpha), [g, path, final]);
  const ARROW = ["↑", "↓", "→", "←"];
  const cell = (Qs: number[][], s: number) => {
    if (s === g.goal) return "★";
    const a = Qs[s].findIndex((x) => x > 0);
    return a < 0 ? "" : `${ARROW[a]}${f(Qs[s][a], 3)}`;
  };
  const grid = (Qs: number[][], label: string) => (
    <table className="track-grid credit-grid" aria-label={label}>
      <tbody>
        {Array.from({ length: g.rows }, (_, r) => (
          <tr key={r}>
            {Array.from({ length: g.cols }, (_, c) => {
              const s = r * g.cols + c;
              const onPath = path.some((p) => p.s === s);
              return (
                <td key={c} className={s === g.goal ? "finish" : onPath ? "startline" : ""}>
                  {cell(Qs, s)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <section className="card" aria-labelledby="pc-h">
      <h2 id="pc-h">Credit from one episode (Example 7.2)</h2>
      <p className="muted small">
        A {path.length}-step path (shaded) through a 7 × 10 gridworld ends at ★, the only reward (+1). All action values start at 0, γ = 1, α = {alpha}. Each cell shows the action value raised by the
        episode. One-step Sarsa raises only the last action; Sarsa(λ) raises every action on the path, falling off by γλ per step back. Under Watkins's Q(λ), declaring one move exploratory cuts the
        traces there, so the earlier moves get nothing.
      </p>
      <div className="inputs">
        <label>
          λ <NumberInput label="lambda for the trace method" value={lambda} min={0} max={1} onChange={setLambda} />
        </label>
        <label>
          Exploratory move (Watkins's Q(λ)){" "}
          <select value={cut} onChange={(e) => setCut(Number(e.target.value))}>
            <option value={0}>none</option>
            {path.slice(1).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                move {i + 2}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="ttt-row">
        <div>
          <h3>One-step Sarsa</h3>
          {grid(one, "Action values raised by one-step Sarsa")}
        </div>
        <div>
          <h3>{cut ? "Watkins's Q(λ)" : "Sarsa(λ)"}, λ = {lambda}</h3>
          {grid(Q, "Action values raised with eligibility traces")}
        </div>
      </div>
      <p className="muted small">{Q.flat().filter((x) => x > 0).length} action values raised with traces, against 1 with one-step Sarsa.</p>
    </section>
  );
}

export function TracesLab() {
  return (
    <>
      <TdLambdaStepper />
      <TraceTypes />
      <WalkExperiment />
      <PathCredit />
    </>
  );
}
