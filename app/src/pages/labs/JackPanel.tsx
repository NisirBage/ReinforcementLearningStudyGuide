// Jack's car rental (Example 4.2, Figure 4.4) and its Exercise 4.5 variant, solved by policy iteration in
// lib/rl/envs/jacksCarRental.ts. Each policy π_k is drawn as the draft draws it: rows are cars at the first location
// (20 at the top), columns cars at the second, and each cell gives the net number of cars moved from the first
// location to the second overnight. Presentation only.
import { useMemo, useState } from "react";
import { JACK_EXAMPLE, JACK_EXERCISE_4_5, jackPolicyIteration } from "../../lib/rl/envs/jacksCarRental";

/** A diverging fill: moves from the first location in the accent colour, moves to it in the second colour, none neutral. */
const fill = (a: number) => (a === 0 ? undefined : `color-mix(in srgb, ${a > 0 ? "var(--accent)" : "var(--sup)"} ${18 + 14 * Math.abs(a)}%, var(--surface-2))`);

export function JackPanel() {
  const [variant, setVariant] = useState<"example" | "exercise">("example");
  const [k, setK] = useState(0);
  const run = useMemo(() => jackPolicyIteration(variant === "example" ? JACK_EXAMPLE : JACK_EXERCISE_4_5), [variant]);
  const last = run.iterations.length - 1;
  const it = run.iterations[Math.min(k, last)];
  const kk = Math.min(k, last);
  const vmin = Math.min(...it.v);
  const vmax = Math.max(...it.v);
  const rows = Array.from({ length: 21 }, (_, i) => 20 - i);
  return (
    <section className="card" aria-labelledby="jack-h">
      <h2 id="jack-h">Jack's car rental (Example 4.2)</h2>
      <p className="muted small">
        Two locations, at most 20 cars each; Poisson requests (means 3 and 4) and returns (3 and 2); $10 per rental, $2 per car moved, at most 5 moved; γ = 0.9. Policy iteration starts from the policy that
        never moves a car, as in Figure 4.4. Within a day, cars are moved overnight, rented, and then the returns arrive; the draft implies but does not spell out this order.
      </p>
      <div className="inputs">
        <label>
          Variant{" "}
          <select value={variant} onChange={(e) => (setVariant(e.target.value as "example" | "exercise"), setK(0))}>
            <option value="example">Example 4.2 as in the draft</option>
            <option value="exercise">Exercise 4.5: one free shuttle, $4 for more than 10 cars parked</option>
          </select>
        </label>
        <label>
          Policy{" "}
          <select value={kk} onChange={(e) => setK(Number(e.target.value))}>
            {run.iterations.map((_, i) => (
              <option key={i} value={i}>
                π{String(i).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)])}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p role="status">
        π{kk}: evaluated in {it.sweeps} sweeps{kk > 0 ? `; ${it.changed} of 441 states changed action in the improvement that produced it` : ""}.{" "}
        {kk === last && run.stable ? "The next improvement changes nothing: this policy is optimal." : ""} Its values run from {vmin.toFixed(1)} to {vmax.toFixed(1)}.
      </p>
      <div className="jack-wrap">
        <table className="jack-grid" aria-label={`Policy π${kk}: cars moved from the first location to the second`}>
          <tbody>
            {rows.map((c1) => (
              <tr key={c1}>
                <th scope="row">{c1}</th>
                {Array.from({ length: 21 }, (_, c2) => {
                  const a = it.policy[c1 * 21 + c2];
                  return (
                    <td key={c2} style={{ background: fill(a) }} aria-label={`${c1} at the first location, ${c2} at the second: move ${a}`}>
                      {a}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th scope="row" />
              {Array.from({ length: 21 }, (_, c2) => (
                <th key={c2} scope="col">
                  {c2}
                </th>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Rows: cars at the first location (20 at the top). Columns: cars at the second location. Positive numbers move cars from the first location to the second; negative numbers the other way. Our
        π₄ agrees with the figure along its top and bottom rows (check ch04.jack-figure-4-4). The values of the optimal policy run from about 421 to 637, while the axis of the figure's value plot is
        labelled 420 and 612; we have not found the reason (flagged on the example).
      </p>
    </section>
  );
}
