// Bandit laboratory: configure a testbed and up to four methods; step through one run with every number of each
// update shown; or average many runs (Figures 2.1–2.4, and Exercise 2.4's nonstationary testbed); or run the
// parameter study of Figure 2.5. All computation is in lib/rl/banditLab.ts.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FIG_2_5, FIG_2_5_EXPONENTS, TESTBED_10, expectedMaxNormal, finishCurves, meanOver, recordRun, runBlock, studyMethods, studyResult, type Curves, type Method,
  type StepDetail, type Testbed,
} from "../../lib/rl/banditLab";
import { LineChart } from "../../components/LineChart";
import { Tex } from "../../components/math";
import { NumberInput } from "../../components/NumberInput";

const SA = { kind: "sample-average" } as const;
const CONST = (alpha: number) => ({ kind: "constant", alpha }) as const;

interface Preset {
  label: string;
  testbed: Testbed;
  methods: Method[];
  note: string;
  steps?: number; // the experiment's suggested number of steps (default 1000)
}
export const PRESETS: Record<string, Preset> = {
  fig21: {
    label: "Figure 2.1: greedy and ε-greedy",
    testbed: TESTBED_10,
    methods: [{ kind: "epsilon-greedy", epsilon: 0, q1: 0, step: SA }, { kind: "epsilon-greedy", epsilon: 0.01, q1: 0, step: SA }, { kind: "epsilon-greedy", epsilon: 0.1, q1: 0, step: SA }],
    note: "Sample averages. The draft reports greedy levelling off at a reward of about 1, finding the optimal action in about one-third of tasks; the best possible is about 1.55.",
  },
  fig22: {
    label: "Figure 2.2: optimistic initial values",
    testbed: TESTBED_10,
    methods: [{ kind: "epsilon-greedy", epsilon: 0, q1: 5, step: CONST(0.1) }, { kind: "epsilon-greedy", epsilon: 0.1, q1: 0, step: CONST(0.1) }],
    note: "Both use α = 0.1. Optimistic greedy explores at first, so it starts worse and then overtakes.",
  },
  fig23: {
    label: "Figure 2.3: UCB",
    testbed: TESTBED_10,
    methods: [{ kind: "ucb", c: 2, q1: 0, step: SA }, { kind: "epsilon-greedy", epsilon: 0.1, q1: 0, step: SA }],
    note: "UCB tries each untried arm first (N = 0 counts as maximizing), which explains the spike at step 11.",
  },
  fig24: {
    label: "Figure 2.4: gradient bandit",
    testbed: { ...TESTBED_10, meanOfMeans: 4 },
    methods: [{ kind: "gradient", alpha: 0.1, baseline: true }, { kind: "gradient", alpha: 0.4, baseline: true }, { kind: "gradient", alpha: 0.1, baseline: false }, { kind: "gradient", alpha: 0.4, baseline: false }],
    note: "True values centred on +4. The baseline adapts at once; without it, learning is much worse.",
  },
  ex24: {
    label: "Exercise 2.4 (lab task): a nonstationary testbed",
    testbed: { ...TESTBED_10, sdOfMeans: 0, walkSd: 0.01 },
    methods: [{ kind: "epsilon-greedy", epsilon: 0.1, q1: 0, step: SA }, { kind: "epsilon-greedy", epsilon: 0.1, q1: 0, step: CONST(0.1) }],
    note: "Every q(a) starts at 0, and after each step each one moves by an independent normal step with standard deviation 0.01. The draft does not give the size of the walk; 0.01 is our choice. Both methods use ε = 0.1, as the exercise asks; runs are 10,000 steps long.",
    steps: 10_000,
  },
};

export function methodLabel(m: Method): string {
  const step = (s: { kind: string; alpha?: number }) => (s.kind === "sample-average" ? "sample avg" : `α=${s.alpha}`);
  if (m.kind === "epsilon-greedy") return `${m.epsilon === 0 ? "greedy" : `ε=${m.epsilon}`}${m.q1 ? `, Q₁=${m.q1}` : ""}, ${step(m.step)}`;
  if (m.kind === "ucb") return `UCB c=${m.c}${m.q1 ? `, Q₁=${m.q1}` : ""}, ${step(m.step)}`;
  return `gradient α=${m.alpha}, ${m.baseline ? "baseline" : "no baseline"}`;
}

/** The shortest label that still tells the methods apart: the part before the first comma, unless that repeats. */
function methodShort(ms: Method[], i: number): string {
  const first = (m: Method) => methodLabel(m).split(", ")[0];
  const dup = ms.filter((m) => first(m) === first(ms[i])).length > 1;
  const m = ms[i];
  if (!dup) return first(m);
  if (m.kind === "gradient") return `α=${m.alpha}${m.baseline ? "" : " no R̄"}`;
  return methodLabel(m).replace(", sample avg", "").replace(/^(greedy|ε=[\d.]+|UCB c=[\d.]+), /, "");
}

const f3 = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : x > 0 ? "∞" : "–");

function MethodEditor({ m, onChange, onRemove, index }: { m: Method; onChange: (m: Method) => void; onRemove?: () => void; index: number }) {
  const step = m.kind === "gradient" ? null : m.step;
  return (
    <fieldset className="card method">
      <legend>
        <span className={`swatch s${index + 1}`} aria-hidden="true" /> Method {index + 1}
      </legend>
      <div className="inputs">
        <label>
          Kind{" "}
          <select
            value={m.kind}
            onChange={(e) =>
              onChange(
                e.target.value === "ucb" ? { kind: "ucb", c: 2, q1: 0, step: SA } : e.target.value === "gradient" ? { kind: "gradient", alpha: 0.1, baseline: true } : { kind: "epsilon-greedy", epsilon: 0.1, q1: 0, step: SA },
              )
            }
          >
            <option value="epsilon-greedy">greedy / ε-greedy (§2.2)</option>
            <option value="ucb">UCB (§2.6)</option>
            <option value="gradient">gradient bandit (§2.7)</option>
          </select>
        </label>
        {m.kind === "epsilon-greedy" && (
          <label>
            ε <NumberInput label="ε" value={m.epsilon} min={0} max={1} onChange={(x) => onChange({ ...m, epsilon: x })} />
          </label>
        )}
        {m.kind === "ucb" && (
          <label>
            c <NumberInput label="c" value={m.c} min={0.0001} onChange={(x) => onChange({ ...m, c: x })} />
          </label>
        )}
        {m.kind !== "gradient" && (
          <label>
            Q₁ <NumberInput label="Q₁" value={m.q1} onChange={(x) => onChange({ ...m, q1: x })} />
          </label>
        )}
        {step && m.kind !== "gradient" && (
          <label>
            Step size{" "}
            <select value={step.kind} onChange={(e) => onChange({ ...m, step: e.target.value === "constant" ? CONST(0.1) : SA })}>
              <option value="sample-average">1/N (sample average, 2.3)</option>
              <option value="constant">constant α (2.5)</option>
            </select>
          </label>
        )}
        {step?.kind === "constant" && m.kind !== "gradient" && (
          <label>
            α <NumberInput label="α" value={step.alpha} min={0.0001} max={1} onChange={(x) => onChange({ ...m, step: CONST(x) })} />
          </label>
        )}
        {m.kind === "gradient" && (
          <>
            <label>
              α <NumberInput label="α" value={m.alpha} min={0.0001} onChange={(x) => onChange({ ...m, alpha: x })} />
            </label>
            <label className="check">
              <input type="checkbox" checked={m.baseline} onChange={(e) => onChange({ ...m, baseline: e.target.checked })} /> baseline R̄ₜ
            </label>
          </>
        )}
        {onRemove && (
          <button type="button" className="btn btn-small" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
    </fieldset>
  );
}

/** The arithmetic of one step, written out with the numbers. */
function StepExplain({ d, m, q }: { d: StepDetail; m: Method; q: number[] }) {
  const a = d.action;
  const lines: string[] = [`t = ${d.t}`];
  if (m.kind === "epsilon-greedy")
    lines.push(m.epsilon === 0 ? `greedy: A_t = an arm with the largest Q_t (ties broken at random) = ${a + 1}` : d.explored ? `explore (probability ε = ${m.epsilon}): A_t chosen uniformly = ${a + 1}` : `exploit (probability 1 − ε): A_t = argmax Q_t = ${a + 1}`);
  if (m.kind === "ucb") lines.push(`A_t = argmax [Q_t(a) + ${m.c}·√(ln ${d.t} / N_t(a))] = ${a + 1}${d.scores![a] === Infinity ? " (untried: N = 0 counts as maximizing)" : `, score ${f3(d.scores![a])}`}`);
  if (m.kind === "gradient") lines.push(`π_t(a) = e^{H_t(a)} / Σ_b e^{H_t(b)}; sampled A_t = ${a + 1} with π_t(A_t) = ${f3(d.probs![a])}`);
  lines.push(`R_t = ${f3(d.reward)}  (drawn from N(q(${a + 1}) = ${f3(q[a])}, σ²))`);
  if (m.kind === "gradient") {
    const diff = d.reward - d.baseline!;
    lines.push(m.baseline ? `R̄_t = mean of all ${d.t} rewards so far, including R_t = ${f3(d.baseline!)}` : `no baseline: R̄_t = 0`);
    lines.push(`H(${a + 1}) ← ${f3(d.before[a])} + ${m.alpha}·(${f3(d.reward)} − ${f3(d.baseline!)})·(1 − ${f3(d.probs![a])}) = ${f3(d.after[a])}`);
    lines.push(`other arms: H(b) ← H(b) − ${m.alpha}·(${f3(diff)})·π_t(b)`);
  } else {
    const N = d.counts[a] + 1;
    const s = m.step.kind === "sample-average" ? `1/N = 1/${N}` : `α = ${m.step.alpha}`;
    lines.push(`Q(${a + 1}) ← Q + step·(R − Q) = ${f3(d.before[a])} + ${s}·(${f3(d.reward)} − ${f3(d.before[a])}) = ${f3(d.after[a])}`);
  }
  return <pre className="calc" aria-live="polite">{lines.join("\n")}</pre>;
}

export function Inspector({ testbed, methods }: { testbed: Testbed; methods: Method[] }) {
  const [mi, setMi] = useState(0);
  const [seed, setSeed] = useState(1);
  const [t, setT] = useState(0);
  const [showTrue, setShowTrue] = useState(true);
  const method = methods[Math.min(mi, methods.length - 1)];
  useEffect(() => setT(0), [method, seed, testbed]);
  const MAX = 1000;
  const run = useMemo(() => recordRun(testbed, method, MAX, seed, 0, Math.min(mi, methods.length - 1)), [testbed, method, seed, mi, methods.length]);
  const d = t > 0 ? run.details[t - 1] : null;
  const shown = run.details.slice(0, t);
  const total = shown.reduce((s, x) => s + x.reward, 0);
  const optimal = shown.filter((x) => x.optimal).length;
  // The true values when step t was taken (they move after every step on a nonstationary testbed).
  const qNow = run.qs[Math.max(0, t - 1)];
  const bestNow = qNow.indexOf(Math.max(...qNow));
  const valuesNow = d ? d.after : run.details[0].before;
  const countsNow = d ? d.counts.map((c, i) => c + (i === d.action ? 1 : 0)) : new Array(testbed.arms).fill(0);
  const probsNow = method.kind === "gradient" ? softmaxView(valuesNow) : null;
  return (
    <section className="card" aria-labelledby="insp-h">
      <h2 id="insp-h">Step through one run</h2>
      <div className="inputs">
        <label>
          Method{" "}
          <select value={mi} onChange={(e) => setMi(Number(e.target.value))}>
            {methods.map((m, i) => (
              <option key={i} value={i}>
                {i + 1}: {methodLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Seed <NumberInput label="Seed of the stepped run" value={seed} integer onChange={setSeed} />
        </label>
        <label className="check">
          <input type="checkbox" checked={showTrue} onChange={(e) => setShowTrue(e.target.checked)} /> show true values q(a)
        </label>
      </div>
      <div className="actions">
        <button type="button" className="btn" disabled={t === 0} onClick={() => setT((x) => x - 1)}>
          ← Back
        </button>
        <button type="button" className="btn btn-primary" disabled={t >= MAX} onClick={() => setT((x) => Math.min(MAX, x + 1))}>
          Step
        </button>
        <button type="button" className="btn" disabled={t >= MAX} onClick={() => setT((x) => Math.min(MAX, x + 10))}>
          +10 steps
        </button>
        <button type="button" className="btn" disabled={t >= MAX} onClick={() => setT(MAX)}>
          To step {MAX}
        </button>
        <button type="button" className="btn" disabled={t === 0} onClick={() => setT(0)}>
          Reset
        </button>
      </div>
      <p className="muted small" role="status">
        Step {t} of {MAX} · total reward {f3(total)} · average reward {t ? f3(total / t) : "–"} · optimal action chosen {t ? `${optimal} times (${Math.round((100 * optimal) / t)}%)` : "–"}
      </p>
      {d ? <StepExplain d={d} m={method} q={qNow} /> : <p className="muted">Press Step to take the first action.</p>}
      {testbed.walkSd ? <p className="muted small">Nonstationary testbed: the true values q(a) shown are those at step {Math.max(1, t)}; they move after every step.</p> : null}
      <table className="lab-table">
        <caption className="sr-only">Arms after step {t}</caption>
        <thead>
          <tr>
            <th scope="col">Arm</th>
            {showTrue && <th scope="col">q(a)</th>}
            <th scope="col">N(a)</th>
            <th scope="col">{method.kind === "gradient" ? "H(a)" : "Q(a)"}</th>
            {probsNow && <th scope="col">π(a)</th>}
            {method.kind === "ucb" && d && <th scope="col">UCB score at t</th>}
          </tr>
        </thead>
        <tbody>
          {valuesNow.map((v, a) => (
            <tr key={a} className={d?.action === a ? "chosen" : ""}>
              <td>
                {a + 1}
                {d?.action === a ? " ← A_t" : ""}
              </td>
              {showTrue && <td className={a === bestNow ? "best num" : "num"}>{f3(qNow[a])}</td>}
              <td className="num">{countsNow[a]}</td>
              <td className="num">{f3(v)}</td>
              {probsNow && <td className="num">{f3(probsNow[a])}</td>}
              {method.kind === "ucb" && d && <td className="num">{f3(d.scores![a])}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {showTrue && <p className="muted small">★ marks the optimal arm (largest q(a)). The agent never sees q(a); it only sees rewards.</p>}
      {t > 1 && (
        <details>
          <summary>Last {Math.min(10, t)} steps</summary>
          <table className="lab-table">
            <thead>
              <tr>
                <th scope="col">t</th>
                <th scope="col">A_t</th>
                <th scope="col">R_t</th>
                <th scope="col">optimal?</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(-10).map((x) => (
                <tr key={x.t}>
                  <td>{x.t}</td>
                  <td>{x.action + 1}</td>
                  <td className="num">{f3(x.reward)}</td>
                  <td>{x.optimal ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}

const softmaxView = (h: number[]) => {
  const m = Math.max(...h);
  const e = h.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
};

function Experiment({ testbed, methods, suggestedSteps }: { testbed: Testbed; methods: Method[]; suggestedSteps?: number }) {
  const [runs, setRuns] = useState(2000);
  const [steps, setSteps] = useState(suggestedSteps ?? 1000);
  // A preset suggests a run length; editing the set-up (preset "custom") keeps whatever is entered.
  useEffect(() => void (suggestedSteps !== undefined && setSteps(suggestedSteps)), [suggestedSteps]);
  const [seed, setSeed] = useState(7);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ curves: Curves[]; methods: Method[]; testbed: Testbed; runs: number; steps: number } | null>(null);
  const cancel = useRef(false);
  useEffect(() => () => void (cancel.current = true), []);
  const go = () => {
    cancel.current = false;
    const ms = methods.map((m) => ({ ...m }));
    let acc: Curves[] | undefined;
    let done = 0;
    const BLOCK = 50;
    setProgress(0);
    // Runs are processed in blocks so the page stays responsive; the result does not depend on the block size.
    const next = () => {
      if (cancel.current) return setProgress(null);
      const to = Math.min(runs, done + BLOCK);
      acc = runBlock(testbed, ms, steps, seed, done, to, acc);
      done = to;
      setProgress(done / runs);
      if (done < runs) setTimeout(next, 0);
      else {
        setResult({ curves: finishCurves(acc, runs), methods: ms, testbed, runs, steps });
        setProgress(null);
      }
    };
    setTimeout(next, 0);
  };
  const best = result && result.testbed.sdOfMeans > 0 && !result.testbed.walkSd ? result.testbed.meanOfMeans + result.testbed.sdOfMeans * expectedMaxNormal(result.testbed.arms) : null;
  return (
    <section className="card" aria-labelledby="exp-h">
      <h2 id="exp-h">Average many runs</h2>
      <p className="muted small">Each run draws a new problem; every method faces the same problems (same seed). The draft averages 2000 runs of 1000 steps.</p>
      <div className="inputs">
        <label>
          Runs <NumberInput label="Runs" value={runs} min={1} max={5000} integer onChange={setRuns} />
        </label>
        <label>
          Steps <NumberInput label="Steps" value={steps} min={10} max={20000} integer onChange={setSteps} />
        </label>
        <label>
          Seed <NumberInput label="Seed of the experiment" value={seed} integer onChange={setSeed} />
        </label>
        {progress === null ? (
          <button type="button" className="btn btn-primary" onClick={go}>
            Run
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => (cancel.current = true)}>
            Stop
          </button>
        )}
      </div>
      {progress !== null && (
        <p role="status" className="muted">
          Running… {Math.round(progress * 100)}%
        </p>
      )}
      {result && (
        <>
          <LineChart
            title={`Average reward (${result.runs} runs)`}
            series={result.curves.map((c, i) => ({ label: methodLabel(result.methods[i]), short: methodShort(result.methods, i), values: c.avgReward }))}
            xLabel="Step"
            yLabel="average reward"
            format={(v) => v.toFixed(2)}
            reference={best !== null ? { y: best, label: `best possible ≈ ${best.toFixed(3)}` } : undefined}
          />
          <LineChart
            title="% optimal action"
            series={result.curves.map((c, i) => ({ label: methodLabel(result.methods[i]), short: methodShort(result.methods, i), values: c.pctOptimal }))}
            xLabel="Step"
            yLabel="share of runs choosing an optimal action"
            format={(v) => `${Math.round(v * 100)}%`}
            yMin={0}
            yMax={1}
          />
          <table className="lab-table">
            <caption>Over the last 10% of steps</caption>
            <thead>
              <tr>
                <th scope="col">Method</th>
                <th scope="col">average reward</th>
                <th scope="col">% optimal</th>
              </tr>
            </thead>
            <tbody>
              {result.curves.map((c, i) => {
                const from = Math.floor(result.steps * 0.9);
                return (
                  <tr key={i}>
                    <td>
                      <span className={`swatch s${i + 1}`} aria-hidden="true" /> {methodLabel(result.methods[i])}
                    </td>
                    <td className="num">{meanOver(c.avgReward, from, result.steps).toFixed(3)}</td>
                    <td className="num">{(100 * meanOver(c.pctOptimal, from, result.steps)).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {best !== null && (
            <p className="muted small">
              Best possible average reward: <Tex tex={`\\mathbb{E}[\\max_a q(a)] \\approx ${best.toFixed(4)}`} /> (exact, by integration). The draft says about 1.55 for the 10-armed testbed.
            </p>
          )}
          {result.testbed.walkSd ? (
            <p className="muted small">The true values move on every step, so "optimal" means the arm with the largest q(a) at that step.</p>
          ) : null}
        </>
      )}
    </section>
  );
}

const POW2 = (e: number) => (e >= 0 ? String(2 ** e) : `1/${2 ** -e}`);
/** Where the draft's curves peak in Figure 2.5, read from the page image (approximate). */
const FIG_2_5_PEAKS: Record<string, string> = {
  "epsilon-greedy": "ε = 1/16, about 1.31",
  gradient: "α = 1/4, about 1.38",
  ucb: "c = 1/2 and 1, about 1.47",
  optimistic: "Q₁ = 1, about 1.44",
};

/** Figure 2.5: every method's average reward over the first 1000 steps, against its parameter. */
export function ParameterStudy() {
  const [runs, setRuns] = useState(200);
  const [seed, setSeed] = useState(25);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ values: number[][]; runs: number } | null>(null);
  const cancel = useRef(false);
  useEffect(() => () => void (cancel.current = true), []);
  const STEPS = 1000;
  const go = () => {
    cancel.current = false;
    const ms = studyMethods(FIG_2_5);
    let acc: Curves[] | undefined;
    let done = 0;
    const BLOCK = 10;
    setProgress(0);
    const next = () => {
      if (cancel.current) return setProgress(null);
      const to = Math.min(runs, done + BLOCK);
      acc = runBlock(TESTBED_10, ms, STEPS, seed, done, to, acc);
      done = to;
      setProgress(done / runs);
      if (done < runs) setTimeout(next, 0);
      else {
        setResult({ values: studyResult(FIG_2_5, acc, runs, STEPS), runs });
        setProgress(null);
      }
    };
    setTimeout(next, 0);
  };
  const series = result
    ? FIG_2_5.map((f, i) => ({
        label: `${f.label} (${f.param})`,
        short: f.label,
        values: FIG_2_5_EXPONENTS.map((e) => {
          const j = f.exponents.indexOf(e);
          return j < 0 ? NaN : result.values[i][j];
        }),
      }))
    : [];
  return (
    <section className="card" aria-labelledby="study-h">
      <h2 id="study-h">Parameter study (Figure 2.5)</h2>
      <p className="muted small">
        Each point is one method at one parameter value, scored by its average reward over the first 1000 steps (the area under its learning curve), on the draft's 10-armed testbed. The parameter
        values double from point to point: ε for ε-greedy, α for the gradient bandit (with the baseline), c for UCB, and the initial estimate Q₁ for greedy with α = 0.1. The ranges are read from the
        figure. The draft averages 2000 runs; fewer runs are quicker and noisier.
      </p>
      <div className="inputs">
        <label>
          Runs <NumberInput label="Runs of the parameter study" value={runs} min={1} max={2000} integer onChange={setRuns} />
        </label>
        <label>
          Seed <NumberInput label="Seed of the parameter study" value={seed} integer onChange={setSeed} />
        </label>
        {progress === null ? (
          <button type="button" className="btn btn-primary" onClick={go}>
            Run the study
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => (cancel.current = true)}>
            Stop
          </button>
        )}
      </div>
      {progress !== null && (
        <p role="status" className="muted">
          Running… {Math.round(progress * 100)}%
        </p>
      )}
      {result && (
        <>
          <LineChart
            title={`Average reward over the first 1000 steps (${result.runs} runs)`}
            series={series}
            xLabel="ε / α / c / Q₁"
            yLabel="average reward over the first 1000 steps"
            format={(v) => v.toFixed(3)}
            xLabels={FIG_2_5_EXPONENTS.map(POW2)}
          />
          <table className="lab-table">
            <caption>Best setting of each method</caption>
            <thead>
              <tr>
                <th scope="col">Method</th>
                <th scope="col">best parameter here</th>
                <th scope="col">average reward</th>
                <th scope="col">the draft's peak (read from the figure)</th>
              </tr>
            </thead>
            <tbody>
              {FIG_2_5.map((f, i) => {
                const vals = result.values[i];
                const j = vals.indexOf(Math.max(...vals));
                return (
                  <tr key={f.key}>
                    <td>
                      <span className={`swatch s${i + 1}`} aria-hidden="true" /> {f.label}
                    </td>
                    <td>
                      {f.param} = {POW2(f.exponents[j])}
                    </td>
                    <td className="num">{vals[j].toFixed(3)}</td>
                    <td>{FIG_2_5_PEAKS[f.key]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

export function BanditLab() {
  const [preset, setPreset] = useState("fig21");
  const [testbed, setTestbed] = useState<Testbed>(PRESETS.fig21.testbed);
  const [methods, setMethods] = useState<Method[]>(PRESETS.fig21.methods);
  const load = (k: string) => {
    setPreset(k);
    setTestbed(PRESETS[k].testbed);
    setMethods(PRESETS[k].methods);
  };
  return (
    <>
      <section className="card" aria-labelledby="cfg-h">
        <h2 id="cfg-h">Set up</h2>
        <div className="inputs">
          <label>
            Preset{" "}
            <select value={preset} onChange={(e) => load(e.target.value)}>
              {Object.entries(PRESETS).map(([k, p]) => (
                <option key={k} value={k}>
                  {p.label}
                </option>
              ))}
              <option value="custom" disabled>
                custom (edited)
              </option>
            </select>
          </label>
        </div>
        {preset !== "custom" && <p className="muted small">{PRESETS[preset].note}</p>}
        <div className="inputs">
          <label>
            Arms n <NumberInput label="Arms n" value={testbed.arms} min={2} max={20} integer onChange={(x) => (setPreset("custom"), setTestbed({ ...testbed, arms: x }))} />
          </label>
          <label>
            Mean of q(a) <NumberInput label="Mean of q(a)" value={testbed.meanOfMeans} onChange={(x) => (setPreset("custom"), setTestbed({ ...testbed, meanOfMeans: x }))} />
          </label>
          <label>
            Spread of q(a) <NumberInput label="Spread of q(a)" value={testbed.sdOfMeans} min={0} onChange={(x) => (setPreset("custom"), setTestbed({ ...testbed, sdOfMeans: x }))} />
          </label>
          <label>
            Reward noise σ <NumberInput label="Reward noise σ" value={testbed.rewardSd} min={0} onChange={(x) => (setPreset("custom"), setTestbed({ ...testbed, rewardSd: x }))} />
          </label>
          <label>
            Random walk per step{" "}
            <NumberInput label="Random walk per step" value={testbed.walkSd ?? 0} min={0} onChange={(x) => (setPreset("custom"), setTestbed({ ...testbed, walkSd: x }))} />
          </label>
        </div>
        <p className="muted small">
          Each problem draws <Tex tex="q(a) \sim N(\text{mean}, \text{spread}^2)" />; each reward is <Tex tex="R_t \sim N(q(A_t), \sigma^2)" />. The draft's testbed is 10 arms, mean 0, spread 1, σ = 1,
          with no random walk. A random walk above 0 makes the problem nonstationary: after every step each q(a) moves by an independent normal step with that standard deviation.
        </p>
        {methods.map((m, i) => (
          <MethodEditor
            key={i}
            index={i}
            m={m}
            onChange={(x) => (setPreset("custom"), setMethods(methods.map((y, j) => (j === i ? x : y))))}
            onRemove={methods.length > 1 ? () => (setPreset("custom"), setMethods(methods.filter((_, j) => j !== i))) : undefined}
          />
        ))}
        {methods.length < 4 && (
          <button type="button" className="btn" onClick={() => (setPreset("custom"), setMethods([...methods, { kind: "epsilon-greedy", epsilon: 0.1, q1: 0, step: SA }]))}>
            Add a method
          </button>
        )}
      </section>
      <Inspector testbed={testbed} methods={methods} />
      <Experiment testbed={testbed} methods={methods} suggestedSteps={preset === "custom" ? undefined : (PRESETS[preset].steps ?? 1000)} />
      <ParameterStudy />
    </>
  );
}
