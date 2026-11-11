// Function-approximation laboratory (Chapter 9). Linear gradient-descent TD(λ) with state aggregation on the 19-state
// walk (Figure 9.1); coarse coding of a square wave (Example 9.1, Figure 9.4); the asymptotic bound (9.9) computed
// exactly; and the mountain-car task with tile coding and linear Sarsa(λ) (Example 9.2, Figures 9.10–9.11).
// Computation: lib/rl/approx.ts.
import { useMemo, useRef, useState } from "react";
import { makeRng } from "../../domain/random";
import { randomWalkTrue, sampleWalk } from "../../lib/rl/traces";
import {
  aggregationFeatures, bestWeights, coarseCodingRun, costToGo, intervalFeatures, linearTdLambdaEpisode, linearValue, mcEpisode, newMcAgent, reflectingWalk, rmse, squareWave,
  squareWaveError, stationary, tdFixedPoint, type McAgent,
} from "../../lib/rl/approx";
import { LineChart } from "../../components/LineChart";
import { NumberInput } from "../../components/NumberInput";

// ---------- Linear TD(λ) with state aggregation ----------
export function LinearTdDemo() {
  const [group, setGroup] = useState(4);
  const [lambda, setLambda] = useState(0.5);
  const [alpha, setAlpha] = useState(0.05);
  const feat = useMemo(() => aggregationFeatures(19, group), [group]);
  const w = useRef<number[]>(new Array(Math.ceil(19 / group)).fill(0));
  const rng = useRef(makeRng(1));
  const [episodes, setEpisodes] = useState(0);
  const reset = (g = group) => {
    w.current = new Array(Math.ceil(19 / g)).fill(0);
    rng.current = makeRng(1);
    setEpisodes(0);
  };
  const run = (k: number) => {
    for (let i = 0; i < k; i++) linearTdLambdaEpisode(w.current, sampleWalk(19, rng.current), feat, lambda, alpha, 1);
    setEpisodes((e) => e + k);
  };
  const truth = randomWalkTrue(19).slice(1, 20);
  const approx = Array.from({ length: 19 }, (_, i) => linearValue(w.current, feat(i + 1)));
  const err = Math.sqrt(approx.reduce((t, v, i) => t + (v - truth[i]) ** 2, 0) / 19);
  return (
    <section className="card" aria-labelledby="ltd-h">
      <h2 id="ltd-h">Linear TD(λ) with state aggregation (Figure 9.1)</h2>
      <p className="muted small">
        The 19-state random walk (−1 on the left, +1 on the right, γ = 1). Its states are grouped, and each group shares one weight: x(s) has a 1 for the state's group, so v̂(s, w) = w⊤x(s) is a
        staircase. Each step updates δ = R + γv̂(S′) − v̂(S), e ← γλe + x(S), w ← w + αδe. A staircase cannot fit the true straight line exactly; learning finds a compromise.
      </p>
      <div className="inputs">
        <label>
          Group size{" "}
          <select value={group} onChange={(e) => (setGroup(Number(e.target.value)), reset(Number(e.target.value)))}>
            {[1, 2, 4, 5, 10].map((g) => (
              <option key={g} value={g}>
                {g === 1 ? "1 (tabular)" : g}
              </option>
            ))}
          </select>
        </label>
        <label>
          λ <NumberInput label="trace decay lambda" value={lambda} min={0} max={1} onChange={setLambda} />
        </label>
        <label>
          α <NumberInput label="step size alpha" value={alpha} min={0} max={1} onChange={setAlpha} />
        </label>
        <button type="button" className="btn btn-primary" onClick={() => run(1)}>
          +1 episode
        </button>
        <button type="button" className="btn" onClick={() => run(100)}>
          +100 episodes
        </button>
        <button type="button" className="btn" onClick={() => reset()}>
          Reset
        </button>
      </div>
      <p className="muted" role="status">
        {episodes} episodes; RMS error over the 19 states {err.toFixed(3)}.
      </p>
      <LineChart title="Approximate and true values" series={[{ label: "v̂(s, w)", values: approx }, { label: "true", values: truth }]} xLabel="State" yLabel="value" format={(x) => x.toFixed(2)} yMin={-1} yMax={1} />
    </section>
  );
}

// ---------- Example 9.1 ----------
function CoarseCoding() {
  const [width, setWidth] = useState(0.2);
  const [examples, setExamples] = useState(40);
  const [seed, setSeed] = useState(1);
  const res = useMemo(() => coarseCodingRun(width, 50, [examples], makeRng(seed))[0], [width, examples, seed]);
  const feat = intervalFeatures(width, 50);
  const xs = Array.from({ length: 101 }, (_, i) => i / 100);
  return (
    <section className="card" aria-labelledby="cc-h">
      <h2 id="cc-h">Coarse coding a square wave (Example 9.1, Figure 9.4)</h2>
      <p className="muted small">
        50 interval features spread over the function's extent; random training points; targets from the square wave; α = 0.2/m, where m is the number of features present at the point. Width is a
        fraction of the extent (our narrow, medium and broad: 0.08, 0.2, 0.5; the draft only draws them). Compare few and many examples.
      </p>
      <div className="inputs">
        <label>
          Width{" "}
          <select value={width} onChange={(e) => setWidth(Number(e.target.value))}>
            <option value={0.08}>narrow (0.08)</option>
            <option value={0.2}>medium (0.2)</option>
            <option value={0.5}>broad (0.5)</option>
          </select>
        </label>
        <label>
          Examples{" "}
          <select value={examples} onChange={(e) => setExamples(Number(e.target.value))}>
            {[10, 40, 160, 640, 2560, 10240].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={() => setSeed((s) => s + 1)}>
          New random examples
        </button>
      </div>
      <LineChart
        title={`Learned after ${examples} examples (RMS error ${squareWaveError(width, 50, res.w).toFixed(3)})`}
        series={[{ label: "approximation", values: xs.map((x) => linearValue(res.w, feat(x))) }, { label: "desired function", values: xs.map(squareWave) }]}
        xLabel="x (×100)"
        yLabel="value"
        format={(x) => x.toFixed(2)}
        yMin={-0.5}
        yMax={1.5}
        xFrom={0}
      />
    </section>
  );
}

// ---------- (9.9) ----------
function Bound() {
  const [gamma, setGamma] = useState(0.9);
  const [group, setGroup] = useState(5);
  const rows = useMemo(() => {
    const c = reflectingWalk(20, gamma);
    const d = stationary(c.P);
    const Phi = Array.from({ length: 20 }, (_, s) => aggregationFeatures(20, group)(s + 1));
    const best = rmse(c, Phi, bestWeights(c, Phi, d), d);
    return [0, 0.25, 0.5, 0.75, 0.9, 1].map((l) => ({ l, err: rmse(c, Phi, tdFixedPoint(c, Phi, d, l), d), best, bound: (1 - gamma * l) / (1 - gamma) }));
  }, [gamma, group]);
  return (
    <section className="card" aria-labelledby="bd-h">
      <h2 id="bd-h">How far from the best can TD(λ) end? (9.9)</h2>
      <p className="muted small">
        A continuing 20-state walk with reflecting ends (+1 for pushing against the right end, −1 against the left), aggregated into groups. Errors are weighted by the walk's stationary distribution
        (the on-policy distribution). The weights linear TD(λ) converges to are computed exactly and compared with the minimum-error weights and the bound (1 − γλ)/(1 − γ).
      </p>
      <div className="inputs">
        <label>
          γ{" "}
          <select value={gamma} onChange={(e) => setGamma(Number(e.target.value))}>
            {[0.5, 0.9, 0.99].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label>
          Group size{" "}
          <select value={group} onChange={(e) => setGroup(Number(e.target.value))}>
            {[2, 4, 5, 10].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
      </div>
      <table className="lab-table">
        <caption>RMSE of the TD(λ) fixed point against the best possible</caption>
        <thead>
          <tr>
            <th scope="col">λ</th>
            <th scope="col">RMSE(w∞)</th>
            <th scope="col">ratio to the best</th>
            <th scope="col">bound (9.9)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.l}>
              <td>{r.l}</td>
              <td>{r.err.toFixed(4)}</td>
              <td>{(r.err / r.best).toFixed(3)}</td>
              <td>{r.bound.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ---------- Example 9.2 ----------
export function MountainCar() {
  const ag = useRef<McAgent>(newMcAgent(10, makeRng(100)));
  const rng = useRef(makeRng(0));
  const [steps, setSteps] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const reset = () => {
    ag.current = newMcAgent(10, makeRng(100));
    rng.current = makeRng(0);
    setSteps([]);
  };
  const train = (k: number) => {
    setBusy(true);
    setTimeout(() => {
      const out: number[] = [];
      for (let i = 0; i < k; i++) out.push(mcEpisode(ag.current, { alpha: 0.05, lambda: 0.9, epsilon: 0, traces: "replacing", clearOthers: true }, rng.current));
      setSteps((s) => [...s, ...out]);
      setBusy(false);
    }, 0);
  };
  const ctg = useMemo(() => (steps.length ? costToGo(ag.current, 24, 24) : null), [steps]);
  const max = ctg ? Math.max(1, ...ctg.flat()) : 1;
  return (
    <section className="card" aria-labelledby="mc-h">
      <h2 id="mc-h">Mountain car (Example 9.2, Figure 9.10)</h2>
      <p className="muted small">
        An underpowered car in a valley must first back up the left slope to gain momentum. Reward −1 per step; three actions (reverse, coast, forward). The state (position, velocity) is coded by ten
        9 × 9 tilings with random offsets (10 features present, one per tiling); linear Sarsa(λ) with replacing traces and clearing (Figure 9.8), λ = 0.9, ε = 0, α = 0.05 = 0.5/10. The values start at
        0, which is optimistic, so the agent explores even without ε. Each episode starts from a random position and velocity.
      </p>
      <div className="inputs">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => train(1)}>
          +1 episode
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => train(100)}>
          +100 episodes
        </button>
        <button type="button" className="btn" disabled={busy} onClick={reset}>
          Reset
        </button>
      </div>
      <p className="muted" role="status">
        {busy ? "Driving… " : ""}
        {steps.length} episodes{steps.length ? `; the last took ${steps[steps.length - 1]} steps` : ""}.
      </p>
      {steps.length > 1 && <LineChart title="Steps per episode" series={[{ label: "steps", values: steps }]} xLabel="Episode" yLabel="steps" format={(x) => x.toFixed(0)} yMin={0} />}
      {ctg && (
        <>
          <h3>Cost-to-go, −max_a q̂(s, a, w)</h3>
          <table className="heat-grid" aria-label="Cost-to-go over position (left to right) and velocity (bottom to top)">
            <tbody>
              {[...ctg].reverse().map((row, j) => (
                <tr key={j}>
                  {row.map((v, i) => (
                    <td key={i} style={{ opacity: 0.15 + 0.85 * Math.max(0, v) / max }} title={v.toFixed(0)} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Position runs from −1.2 (left) to 0.5 (right), velocity from −0.07 (bottom) to 0.07 (top); darker is costlier (up to {max.toFixed(0)} steps).</p>
        </>
      )}
    </section>
  );
}

// ---------- Figure 9.11 ----------
function McStudy() {
  const [runs, setRuns] = useState(3);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [series, setSeries] = useState<{ label: string; values: number[] }[] | null>(null);
  const A5 = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2];
  const settings: ["replacing" | "accumulating", number][] = [["replacing", 0], ["replacing", 0.9], ["replacing", 1], ["accumulating", 0.9]];
  const go = () => {
    setBusy(true);
    const out: { label: string; values: number[] }[] = [];
    let k = 0;
    const next = () => {
      const [traces, lambda] = settings[k];
      setProgress(`${traces} traces, λ = ${lambda}…`);
      setTimeout(() => {
        const values = A5.map((a5) => {
          let tot = 0;
          for (let r = 0; r < runs; r++) {
            const ag = newMcAgent(5, makeRng(200 + r));
            const rr = makeRng(r);
            for (let e = 0; e < 20; e++) tot += mcEpisode(ag, { alpha: a5 / 5, lambda, epsilon: 0, traces, clearOthers: traces === "replacing", maxSteps: 4000 }, rr) / (20 * runs);
          }
          return tot > 1000 ? NaN : tot;
        });
        out.push({ label: `${traces}, λ = ${lambda}`, values });
        k++;
        if (k < settings.length) return next();
        setSeries(out);
        setProgress("");
        setBusy(false);
      }, 0);
    };
    next();
  };
  return (
    <section className="card" aria-labelledby="ms-h">
      <h2 id="ms-h">Effect of α, λ and the kind of trace (Figure 9.11)</h2>
      <p className="muted small">
        Five 9 × 9 tilings; steps per episode averaged over the first 20 episodes and the runs (the draft: 30 runs), against α × 5 (α × m). Settings above 1000 steps leave the plot. Slow: about a
        second per run per setting, more where accumulating traces fail.
      </p>
      <div className="inputs">
        <label>
          Runs <NumberInput label="number of runs" value={runs} min={1} max={30} integer onChange={setRuns} />
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
      {series && <LineChart title="Steps per episode, first 20 episodes" series={series} xLabel="α × 5" yLabel="steps" format={(x) => x.toFixed(0)} yMin={0} xLabels={A5.map(String)} />}
    </section>
  );
}

export function ApproxLab() {
  return (
    <>
      <LinearTdDemo />
      <CoarseCoding />
      <Bound />
      <MountainCar />
      <McStudy />
    </>
  );
}
