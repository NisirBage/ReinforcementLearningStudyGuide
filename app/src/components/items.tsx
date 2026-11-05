// Views of structured content items: equations, algorithms, worked examples, figures.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Algorithm, Equation, Example, Figure } from "../content/schema";
import { isSupplementaryUnit } from "../content/schema";
import { CHECKS } from "../content/checks";
import { iterativePolicyEvaluation } from "../lib/rl/dp";
import { equiprobablePolicy } from "../lib/rl/mdp";
import { gridworld4x4, toCells } from "../lib/rl/envs/gridworld4x4";
import { useProgress } from "../store/ProgressContext";
import { Badge, ConceptLink, Sources, SupplementaryBanner } from "./ui";
import { Flags, Md, MdInline, Tex } from "./math";

export function EquationCard({ e, compact = false }: { e: Equation; compact?: boolean }) {
  const { data } = useProgress();
  const sup = isSupplementaryUnit(e.unit);
  const body = (
    <>
      <div className="symbols">
        <h4>Symbols</h4>
        <dl>
          {e.symbols.map((s, i) => (
            <div key={i}>
              <dt>
                <Tex tex={s.tex} />
              </dt>
              <dd>
                <MdInline text={s.meaning} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="intuition">
        <strong>Idea.</strong> <MdInline text={e.intuition} />
      </p>
      {e.assumptions.length > 0 && (
        <div>
          <h4>Assumptions</h4>
          <ul>
            {e.assumptions.map((a, i) => (
              <li key={i}>
                <MdInline text={a} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {e.derivation && (
        <details className="derivation">
          <summary>Derivation, step by step ({e.derivation.length} steps)</summary>
          <ol>
            {e.derivation.map((s, i) => (
              <li key={i}>
                <Tex tex={s.tex} display />
                <p className="why">
                  <MdInline text={s.why} />
                </p>
              </li>
            ))}
          </ol>
        </details>
      )}
      {e.example && (
        <div className="worked">
          <h4>Numerical example</h4>
          <Md text={e.example} />
        </div>
      )}
      {e.significance && (
        <p>
          <strong>Computationally.</strong> <MdInline text={e.significance} />
        </p>
      )}
      {e.pitfalls.length > 0 && (
        <div className="pitfalls">
          <h4>Common mistakes</h4>
          <ul>
            {e.pitfalls.map((p, i) => (
              <li key={i}>
                <MdInline text={p} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <Flags flags={e.flags} />
      <Sources refs={e.sources} />
    </>
  );
  return (
    <section className={`item equation ${sup ? "is-sup" : ""}`} id={e.id} aria-label={`Equation: ${e.name}`}>
      <header className="item-head">
        <span className="item-kind">Equation {e.bookLabel}</span>
        <Link to={`/equation/${e.id}`} className="item-title">
          {e.name}
        </Link>
        {sup && <Badge tone="sup">Supplementary</Badge>}
      </header>
      <div className="formula">
        <Tex tex={e.tex} display />
      </div>
      {data.settings.show2018Notation && e.notation2018 && (
        <div className="xref2018">
          <span className="xref-label">2018 edition (unverified)</span>
          <Tex tex={e.notation2018.tex} display />
          <p className="muted">
            <MdInline text={e.notation2018.note} />
          </p>
        </div>
      )}
      {compact ? (
        <details className="more">
          <summary>Symbols, derivation, example and pitfalls</summary>
          {body}
        </details>
      ) : (
        body
      )}
    </section>
  );
}

export function AlgorithmBox({ a }: { a: Algorithm }) {
  return (
    <section className="item algorithm" id={a.id} aria-label={`Algorithm: ${a.name}`}>
      <header className="item-head">
        <span className="item-kind">Algorithm {a.bookLabel ? `· ${a.bookLabel}` : ""}</span>
        <Link to={`/algorithm/${a.id}`} className="item-title">
          {a.name}
        </Link>
      </header>
      <div className="pseudo" role="group" aria-label="Pseudocode">
        <div className="pseudo-io">
          <strong>Input:</strong>{" "}
          {a.inputs.map((x, i) => (
            <span key={i}>
              {i > 0 && "; "}
              <MdInline text={x} />
            </span>
          ))}
        </div>
        <ol className="pseudo-lines">
          {a.lines.map((l, i) => (
            <li key={i} style={{ paddingLeft: `${l.indent * 1.5}em` }}>
              <MdInline text={l.text} />
            </li>
          ))}
        </ol>
        <div className="pseudo-io">
          <strong>Output:</strong> <MdInline text={a.output} />
        </div>
      </div>
      <p className="muted small">
        Runs in the app as <code>{a.implementation}</code>, which is tested against the book's numbers.
      </p>
      <Flags flags={a.flags} />
      <Sources refs={a.sources} />
    </section>
  );
}

export function ExampleCard({ x }: { x: Example }) {
  const [results, setResults] = useState<Record<string, boolean> | null>(null);
  return (
    <section className="item example" id={x.id} aria-label={`Worked example: ${x.title}`}>
      <header className="item-head">
        <span className="item-kind">Worked example {x.bookLabel ? `· ${x.bookLabel}` : ""}</span>
        <Link to={`/example/${x.id}`} className="item-title">
          {x.title}
        </Link>
      </header>
      <Md text={x.summary} />
      <h4>What the book claims, and what our code reproduces</h4>
      <ul className="facts">
        {x.facts.map((f) => (
          <li key={f.check}>
            {results ? <span className={results[f.check] ? "ok" : "bad"}>{results[f.check] ? "✓" : "✗"}</span> : <span className="muted">•</span>}{" "}
            <MdInline text={f.claim} />
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => setResults(Object.fromEntries(x.facts.map((f) => [f.check, (CHECKS[f.check] as { run: () => boolean }).run()])))}
      >
        {results ? "Re-run the checks" : "Run the checks in your browser"}
      </button>
      <Flags flags={x.flags} />
      <Sources refs={x.sources} />
    </section>
  );
}

function ValueGrids({ f }: { f: Figure & { spec: { kind: "value-grids" } } }) {
  const { rows, cols, terminal, grids, env } = f.spec;
  const [k, setK] = useState(0);
  const [exact, setExact] = useState(false);
  const label = grids[k].label;
  // Exact iterates come from the tested implementation, never from numbers typed into the UI.
  const exactValues = useMemo(() => {
    if (!exact || env !== "gridworld4x4") return null;
    const g = gridworld4x4();
    const pi = equiprobablePolicy(g);
    const n = label.includes("∞") ? 100_000 : Number(label.replace(/\D+/g, ""));
    return toCells(iterativePolicyEvaluation(g, pi, 1, label.includes("∞") ? { theta: 1e-12 } : { theta: 0, maxSweeps: n, mode: "two-array" }).v);
  }, [exact, env, label]);
  return (
    <div>
      <div className="seg" role="tablist" aria-label="Iteration">
        {grids.map((g, i) => (
          <button key={g.label} type="button" role="tab" aria-selected={i === k} className={i === k ? "on" : ""} onClick={() => setK(i)}>
            {g.label}
          </button>
        ))}
      </div>
      <table className="vgrid" aria-label={`${f.title}, ${label}`}>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }, (_, c) => {
                const i = r * cols + c;
                const term = terminal.includes(i);
                return (
                  <td key={c} className={term ? "terminal" : ""}>
                    <span className="printed">{grids[k].values[i].toFixed(1)}</span>
                    {exactValues && !term && <span className="exact">{Number(exactValues[i].toFixed(4))}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {env && (
        <label className="check">
          <input type="checkbox" checked={exact} onChange={(e) => setExact(e.target.checked)} /> Show exact values computed by the app
        </label>
      )}
    </div>
  );
}

function BackupDiagram({ f }: { f: Figure & { spec: { kind: "backup-diagram" } } }) {
  const { root, branching, labels } = f.spec;
  const [n1, n2] = branching;
  const W = 300;
  const H = 170;
  const lvl = [26, 86, 146];
  const x1 = (i: number) => ((i + 0.5) * W) / n1;
  const x2 = (i: number, j: number) => x1(i) + (j - (n2 - 1) / 2) * 30;
  const node = (x: number, y: number, kind: "state" | "action", key: string) =>
    kind === "state" ? <circle key={key} cx={x} cy={y} r={9} className="bd-state" /> : <circle key={key} cx={x} cy={y} r={5} className="bd-action" />;
  const midKind = root === "state" ? "action" : "state";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="backup" role="img" aria-label={`${f.title}: a ${root} node with ${n1} branches, each with ${n2} outcomes`}>
      {Array.from({ length: n1 }, (_, i) => (
        <g key={i}>
          <line x1={W / 2} y1={lvl[0]} x2={x1(i)} y2={lvl[1]} />
          {Array.from({ length: n2 }, (_, j) => (
            <line key={j} x1={x1(i)} y1={lvl[1]} x2={x2(i, j)} y2={lvl[2]} />
          ))}
        </g>
      ))}
      {node(W / 2, lvl[0], root, "root")}
      {Array.from({ length: n1 }, (_, i) => node(x1(i), lvl[1], midKind, `m${i}`))}
      {Array.from({ length: n1 }, (_, i) => Array.from({ length: n2 }, (_, j) => node(x2(i, j), lvl[2], root, `l${i}${j}`)))}
      <text x={W / 2} y={12} textAnchor="middle">
        {labels.root}
      </text>
      {labels.edge && (
        <text x={(W / 2 + x1(n1 - 1)) / 2 + 10} y={(lvl[0] + lvl[1]) / 2 - 2}>
          {labels.edge}
        </text>
      )}
      <text x={x1(n1 - 1) + 10} y={lvl[1] - 6}>
        {labels.mid}
      </text>
      <text x={x1(n1 - 1) + 14} y={(lvl[1] + lvl[2]) / 2 + 4}>
        {labels.reward}
      </text>
      <text x={x2(n1 - 1, n2 - 1) + 12} y={lvl[2] + 5}>
        {labels.leaf}
      </text>
    </svg>
  );
}

export function FigureView({ f }: { f: Figure }) {
  return (
    <figure className="item figure" id={f.id}>
      <header className="item-head">
        <span className="item-kind">Figure {f.bookLabel ? `· ${f.bookLabel}` : ""}</span>
        <Link to={`/figure/${f.id}`} className="item-title">
          {f.title}
        </Link>
        <Badge title="Redrawn by the app from the book's data, not copied">Redrawn</Badge>
      </header>
      {f.spec.kind === "value-grids" ? <ValueGrids f={f as Figure & { spec: { kind: "value-grids" } }} /> : <BackupDiagram f={f as Figure & { spec: { kind: "backup-diagram" } }} />}
      <figcaption>
        <MdInline text={f.caption} />
      </figcaption>
      <Flags flags={f.flags} />
      <Sources refs={f.sources} />
      <p className="chips">
        {f.concepts.map((c) => (
          <ConceptLink key={c} id={c} />
        ))}
      </p>
    </figure>
  );
}

export function SupBannerIf({ unit }: { unit: string }) {
  return isSupplementaryUnit(unit) ? <SupplementaryBanner /> : null;
}
