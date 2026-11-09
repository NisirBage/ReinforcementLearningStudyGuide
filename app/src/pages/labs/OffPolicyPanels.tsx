// Monte Carlo laboratory, Milestone 4F: off-policy prediction by importance sampling (Examples 5.4 and 5.5, Figures 5.7
// and 5.8) and the racetrack of Exercise 5.9, learned by off-policy MC control (Figure 5.10, corrected) and compared
// with the optimum found by value iteration. All computation is in lib/rl (offPolicy.ts, envs/racetrack.ts).
import { useEffect, useMemo, useRef, useState } from "react";
import { makeRng } from "../../domain/random";
import { solveExact } from "../../lib/rl/mdp";
import { deterministic, iterativePolicyEvaluation, valueIteration } from "../../lib/rl/dp";
import { DEAL_STATE, END, bjIndex, blackjack, stickOn20 } from "../../lib/rl/envs/blackjack";
import { INFINITE_VARIANCE_BEHAVIOUR, INFINITE_VARIANCE_TARGET, infiniteVarianceMdp, isEstimates, newOffPolicyControl, offPolicyControlEpisode, type OffPolicyControlState } from "../../lib/rl/offPolicy";
import { TRACK_LEFT, TRACK_RIGHT, greedyTrajectory, racetrack } from "../../lib/rl/envs/racetrack";
import { LineChart } from "../../components/LineChart";
import { NumberInput } from "../../components/NumberInput";

const f = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "–");

/** Example 5.4 (Figure 5.7): mean squared error of ordinary and weighted IS; Example 5.5 (Figure 5.8): ordinary IS estimates of four runs. */
export function ImportanceSampling() {
  const [example, setExample] = useState<"bj" | "loop">("bj");
  const [runs, setRuns] = useState(100);
  const [episodes, setEpisodes] = useState(1000);
  const [result, setResult] = useState<null | { example: "bj" | "loop"; series: { label: string; short: string; values: Float64Array }[]; table: number[][]; truth: number; episodes: number; runs: number }>(null);
  const go = () => {
    if (example === "bj") {
      const m = blackjack();
      const target = stickOn20();
      const behaviour = target.map((row, i) => (i === DEAL_STATE || i === END ? row : [0.5, 0.5, 0]));
      const s = bjIndex(13, 2, true);
      const truth = solveExact(m, target, 1)![s];
      const mseO = new Float64Array(episodes);
      const mseW = new Float64Array(episodes);
      for (let r = 0; r < runs; r++) {
        const c = isEstimates(m, target, behaviour, s, episodes, 1, makeRng(1000 + r));
        for (let n = 0; n < episodes; n++) {
          mseO[n] += (c.ordinary[n] - truth) ** 2 / runs;
          mseW[n] += (c.weighted[n] - truth) ** 2 / runs;
        }
      }
      const marks = [1, 3, 10, 100, 1000, 10000].filter((n) => n <= episodes);
      setResult({
        example, truth, episodes, runs,
        series: [
          { label: "ordinary importance sampling", short: "ordinary", values: mseO },
          { label: "weighted importance sampling", short: "weighted", values: mseW },
        ],
        table: marks.map((n) => [n, mseO[n - 1], 10.156 / n, mseW[n - 1]]),
      });
    } else {
      const m = infiniteVarianceMdp();
      const shown = Math.min(4, runs);
      const series = Array.from({ length: shown }, (_, r) => {
        const c = isEstimates(m, INFINITE_VARIANCE_TARGET, INFINITE_VARIANCE_BEHAVIOUR, 0, episodes, 1, makeRng(77 + r));
        return { label: `run ${r + 1}, ordinary IS`, short: `run ${r + 1}`, values: c.ordinary, weighted: c.weighted[episodes - 1] };
      });
      setResult({ example, truth: 1, episodes, runs: shown, series, table: series.map((s, r) => [r + 1, s.values[episodes - 1], s.weighted]) });
    }
  };
  return (
    <section className="card" aria-labelledby="is-h">
      <h2 id="is-h">Off-policy prediction by importance sampling (§5.5)</h2>
      <p className="muted small">
        Example 5.4: the blackjack state with the dealer showing 2 and a usable ace with sum 13, evaluated for the policy that sticks only on 20 or 21 from games played at random (hit or stick with
        probability 1/2). Example 5.5: one state, "back" (returns with probability 0.9, otherwise ends with +1) or "end"; the target always goes back, the behaviour picks either with probability 1/2.
      </p>
      <div className="inputs">
        <label>
          Example{" "}
          <select value={example} onChange={(e) => (setExample(e.target.value as "bj" | "loop"), setResult(null))}>
            <option value="bj">Example 5.4: blackjack state (Figure 5.7)</option>
            <option value="loop">Example 5.5: infinite variance (Figure 5.8)</option>
          </select>
        </label>
        <label>
          Runs <NumberInput label="Runs of importance sampling" value={runs} min={1} max={500} integer onChange={setRuns} />
        </label>
        <label>
          Episodes <NumberInput label="Episodes per run" value={episodes} min={10} max={100000} integer onChange={setEpisodes} />
        </label>
        <button type="button" className="btn btn-primary" onClick={go}>
          Run
        </button>
      </div>
      {result && result.example === "bj" && (
        <>
          <LineChart title={`Mean squared error (average over ${result.runs} runs)`} series={result.series} xLabel="Episodes" yLabel="mean squared error" format={(v) => v.toFixed(3)} yMin={0} />
          <table className="lab-table">
            <caption>Error after n episodes; the exact error of ordinary IS is Var(ρG)/n with Var(ρG) = 10.156 (computed from the exact model)</caption>
            <thead>
              <tr>
                <th scope="col">n</th>
                <th scope="col">ordinary (measured)</th>
                <th scope="col">ordinary (exact)</th>
                <th scope="col">weighted (measured)</th>
              </tr>
            </thead>
            <tbody>
              {result.table.map(([n, o, ex, w]) => (
                <tr key={n}>
                  <td>{n}</td>
                  <td className="num">{f(o)}</td>
                  <td className="num">{f(ex)}</td>
                  <td className="num">{f(w)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">True value {f(result.truth, 5)} (exact; the draft's estimate from 10⁸ games is −0.27726). Weighted error starts low, rises, then falls: Exercise 5.5 asks why.</p>
        </>
      )}
      {result && result.example === "loop" && (
        <>
          <LineChart title={`Ordinary importance-sampling estimates of v_π(s) (${result.runs} runs)`} series={result.series} xLabel="Episodes" yLabel="estimate" format={(v) => v.toFixed(2)} yMin={0} reference={{ y: 1, label: "v_π(s) = 1" }} />
          <table className="lab-table">
            <caption>Estimates after {result.episodes} episodes</caption>
            <thead>
              <tr>
                <th scope="col">run</th>
                <th scope="col">ordinary</th>
                <th scope="col">weighted</th>
              </tr>
            </thead>
            <tbody>
              {result.table.map(([r, o, w]) => (
                <tr key={r}>
                  <td>{r}</td>
                  <td className="num">{f(o)}</td>
                  <td className="num">{f(w)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Weighted importance sampling is exactly 1 once an episode that ends with "back" has been seen. Ordinary importance sampling has infinite variance here and keeps jumping.</p>
        </>
      )}
    </section>
  );
}

/** Exercise 5.9: the racetrack, learned by off-policy MC control and compared with value iteration's optimum. */
export function Racetrack() {
  const [which, setWhich] = useState<"left" | "right">("left");
  const m = useMemo(() => racetrack(which === "left" ? TRACK_LEFT : TRACK_RIGHT), [which]);
  const vstar = useMemo(() => valueIteration(m, 1, { theta: 1e-9 }).v, [m]);
  const st = useRef<OffPolicyControlState>(newOffPolicyControl(m));
  const rng = useRef(makeRng(59));
  const [episodes, setEpisodes] = useState(0);
  const [busy, setBusy] = useState(false);
  const [start, setStart] = useState(0);
  const cancel = useRef(false);
  useEffect(() => {
    st.current = newOffPolicyControl(m);
    rng.current = makeRng(59);
    setEpisodes(0);
    setStart(0);
  }, [m]);
  useEffect(() => () => void (cancel.current = true), []);
  const train = (n: number) => {
    cancel.current = false;
    setBusy(true);
    let left = n;
    const block = () => {
      if (cancel.current) return setBusy(false);
      const k = Math.min(left, 10_000);
      for (let i = 0; i < k; i++) offPolicyControlEpisode(m, st.current, m.starts[Math.floor(rng.current() * m.starts.length)], 1, 0.1, rng.current);
      left -= k;
      setEpisodes(st.current.episodes);
      if (left > 0) setTimeout(block, 0);
      else setBusy(false);
    };
    setTimeout(block, 0);
  };
  const learned = useMemo(() => (episodes ? iterativePolicyEvaluation(m, deterministic(m, st.current.pi), 1, { theta: 1e-9 }).v : null), [m, episodes]);
  const traj = useMemo(() => (episodes ? greedyTrajectory(m, st.current.pi, m.starts[start]) : null), [m, episodes, start]);
  const onPath = new Map((traj?.cells ?? []).map(([r, c], i) => [`${r},${c}`, i] as const));
  const nCols = Math.max(...m.track.rows.map(([, b]) => b)) + 1;
  return (
    <section className="card" aria-labelledby="rt-h">
      <h2 id="rt-h">Racetrack (Exercise 5.9, lab task)</h2>
      <p className="muted small">
        Tracks from Figure 5.11. Velocities 0–4 in each direction, nine actions changing each component by −1, 0 or +1, −1 per step and −5 for trying to leave the track; on half of the steps the car
        moves one extra cell up or to the right. Some details are ours, as the draft leaves them open: an action that would stop the car sets the upward speed to 1, a move follows the straight line between
        cells, and a car that would leave the track moves one cell up (or right) instead. Learning uses off-policy Monte Carlo control with weighted importance sampling (Figure 5.10, with the correction
        flagged on the concept) and an ε-greedy behaviour policy (ε = 0.1). The optimum is computed by value iteration, which the exact model allows.
      </p>
      <div className="inputs">
        <label>
          Track{" "}
          <select value={which} onChange={(e) => setWhich(e.target.value as "left" | "right")} disabled={busy}>
            <option value="left">{TRACK_LEFT.name}</option>
            <option value="right">{TRACK_RIGHT.name}</option>
          </select>
        </label>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => train(50_000)}>
          +50,000 episodes
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => train(200_000)}>
          +200,000 episodes
        </button>
      </div>
      <p role="status" className="muted">
        {busy ? "Learning… " : ""}
        {episodes} episodes learned.
      </p>
      {learned && traj && (
        <>
          <div className="inputs">
            <label>
              Start cell{" "}
              <select value={start} onChange={(e) => setStart(Number(e.target.value))}>
                {m.starts.map((s, i) => (
                  <option key={s} value={i}>
                    {i + 1} (column {m.decode(s).col + 1})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="jack-wrap">
            <table className="track-grid" aria-label="The track with the learned greedy trajectory, noise off">
              <tbody>
                {m.track.rows.map(([a, b], r) => (
                  <tr key={r}>
                    {Array.from({ length: nCols }, (_, c) => {
                      const on = c >= a && c <= b;
                      const k = onPath.get(`${r},${c}`);
                      const finish = m.track.finishRows.includes(r) && c === b;
                      const startLine = r === m.track.rows.length - 1 && on;
                      return (
                        <td key={c} className={!on ? "off" : finish ? "finish" : startLine ? "startline" : ""}>
                          {k !== undefined ? k : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            Numbers: the cells the learned greedy policy visits from the chosen start, with the extra-cell noise off; it {traj.finished ? `finishes in ${traj.cells.length} steps (return ${traj.reward})` : "does not finish within 500 steps"}.
          </p>
          <table className="lab-table">
            <caption>Expected return from each start cell, with the noise: the learned greedy policy (evaluated exactly) and the optimum (value iteration)</caption>
            <thead>
              <tr>
                <th scope="col">start</th>
                <th scope="col">learned</th>
                <th scope="col">optimal</th>
              </tr>
            </thead>
            <tbody>
              {m.starts.map((s, i) => (
                <tr key={s}>
                  <td>{i + 1}</td>
                  <td className="num">{f(learned[s], 2)}</td>
                  <td className="num">{f(vstar[s], 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">
            Starts far from the turn give long episodes, and this method learns only from the part of each episode after its last exploratory action (§5.7), so they approach the optimum last.
          </p>
        </>
      )}
    </section>
  );
}
