// One page per implemented algorithm: what it solves, what to know first, the equations, a derivation, the
// pseudocode, the code that runs it, a worked example checked by that code, a live step-by-step demonstration,
// strengths and weaknesses, comparisons and practice questions. The text is content (content/algorithms/*.json,
// field `explainer`); the demonstrations are the lab panels themselves.
import { useEffect, useState, type ReactElement } from "react";
import { Link, useParams } from "react-router-dom";
import { cat, useContent } from "../content/load";
import { isSupplementaryUnit, type Algorithm, type Explainer } from "../content/schema";
import { CHECKS } from "../content/checks";
import { AlgorithmBox, EquationCard } from "../components/items";
import { QuestionCard } from "../components/QuestionCard";
import { ConceptLink, PageTitle, SupplementaryBanner } from "../components/ui";
import { Md, MdInline } from "../components/math";
import { loadImplementation } from "../lib/source";
import { TESTBED_10, type Method } from "../lib/rl/banditLab";
import { Inspector } from "./labs/BanditLab";
import { Iteration } from "./labs/BellmanLab";
import { PolicyIterationPanel, ValueIterationPanel, model } from "./labs/DpLab";
import { ExploringStarts, Prediction } from "./labs/McLab";
import { ControlInspector, TdStepper } from "./labs/TdLab";
import { PathCredit, TdLambdaStepper } from "./labs/TracesLab";
import { DynaStepper } from "./labs/PlanningLab";
import { LinearTdDemo, MountainCar } from "./labs/ApproxLab";
import { NotFound } from "./NotFound";

const SA = { kind: "sample-average" } as const;
const EPS: Method[] = [{ kind: "epsilon-greedy", epsilon: 0.1, q1: 0, step: SA }];
const UCB: Method[] = [{ kind: "ucb", c: 2, q1: 0, step: SA }];
const GRAD: Method[] = [{ kind: "gradient", alpha: 0.1, baseline: true }];
const GRAD_BED = { ...TESTBED_10, meanOfMeans: 4 };
const GRID = model("gridworld", 0.4);
const GAMBLER = model("gambler", 0.4);

/** The live demonstration for each demo key, with a line saying what it shows. */
export const DEMOS: Record<Explainer["demo"], { note: string; view: () => ReactElement }> = {
  "bandit-epsilon-greedy": { note: "One run of ε-greedy (ε = 0.1, sample averages) on a 10-armed problem. Step to see the choice, the reward and the update of $Q(A)$.", view: () => <Inspector testbed={TESTBED_10} methods={EPS} /> },
  "bandit-ucb": { note: "One run of UCB with $c = 2$. Each step shows every arm's score $Q(a) + c\\sqrt{\\ln t / N(a)}$ and which one wins.", view: () => <Inspector testbed={TESTBED_10} methods={UCB} /> },
  "bandit-gradient": { note: "One run of the gradient bandit (α = 0.1, with baseline) on the testbed shifted to mean +4. Each step shows π, the baseline and the change to every preference.", view: () => <Inspector testbed={GRAD_BED} methods={GRAD} /> },
  "policy-evaluation": { note: "Iterative policy evaluation of the equiprobable random policy on the 4×4 gridworld, one sweep at a time, with the backup of a chosen state written out.", view: () => <Iteration /> },
  "policy-iteration": { note: "Policy iteration on the 4×4 gridworld: alternate a full evaluation with a greedy improvement and watch which states change action.", view: () => <PolicyIterationPanel m={GRID} /> },
  "value-iteration": { note: "Value iteration on the gambler's problem ($p_h = 0.4$), one sweep at a time, with the largest change Δ after each sweep.", view: () => <ValueIterationPanel m={GAMBLER} /> },
  "mc-prediction": { note: "Monte Carlo prediction on the random walk: generate an episode, see each return $G_t$, which visits count, and every update.", view: () => <Prediction /> },
  "mc-es": { note: "Monte Carlo ES on the 4×4 gridworld: episodes from random state–action pairs, and the greedy policy they produce.", view: () => <ExploringStarts /> },
  td0: { note: "TD(0) on the random walk, one step at a time: $S_t$, $R_{t+1}$, $S_{t+1}$, the target, the TD error and the new $V(S_t)$.", view: () => <TdStepper /> },
  sarsa: { note: "Sarsa on cliff walking, one update at a time: the next action $A_{t+1}$ is chosen ε-greedily first, and its value forms the target.", view: () => <ControlInspector initialMethod="sarsa" /> },
  "q-learning": { note: "Q-learning on cliff walking, one update at a time: the target uses $\\max_a Q(S_{t+1}, a)$, whatever action is taken next.", view: () => <ControlInspector initialMethod="q-learning" /> },
  "td-lambda": { note: "TD(λ) on the random walk, one step at a time: the TD error δ, every state's eligibility trace, and the change it causes; choose the kind of trace, or true on-line TD(λ).", view: () => <TdLambdaStepper /> },
  "sarsa-lambda": { note: "Example 7.2: the action values one episode raises with one-step Sarsa and with traces; declare a move exploratory to see Watkins's Q(λ) cut the traces.", view: () => <PathCredit /> },
  dyna: { note: "Dyna-Q or prioritized sweeping on the maze of Example 8.1: step, or finish an episode, and watch the greedy policy grow back from the goal through planning.", view: () => <DynaStepper /> },
  "linear-td": { note: "Linear gradient-descent TD(λ) on the 19-state walk with state aggregation: one weight per group of states; run episodes and compare the staircase v̂ with the true values.", view: () => <LinearTdDemo /> },
  "mountain-car": { note: "Linear Sarsa(λ) with tile coding on the mountain-car task: train episodes and watch the steps per episode fall and the cost-to-go take shape.", view: () => <MountainCar /> },
};

export function AlgorithmPage() {
  const { id = "" } = useParams();
  const stub = cat.item(id);
  if (!stub || stub.kind !== "algorithm") return <NotFound />;
  return <AlgorithmBody id={id} unit={stub.unit} />;
}

/** Units holding questions on a concept. */
const questionUnits = (concept: string) => cat.catalog.questions.filter((q) => q.concepts.includes(concept)).map((q) => q.unit);

function AlgorithmBody({ id, unit }: { id: string; unit: string }) {
  const idx = useContent(cat.withDeps([unit]));
  const a = idx.algorithm(id);
  if (!a) return <NotFound />;
  const u = cat.unit(a.unit);
  return (
    <>
      <p className="crumb">
        <Link to="/learn">Learn</Link> / {u ? <Link to={`/learn/${u.id}`}>{u.kind === "core" ? `Chapter ${u.core!.chapter}` : u.title}</Link> : a.unit} / algorithm
      </p>
      <PageTitle title={a.name}>{a.name}</PageTitle>
      {isSupplementaryUnit(a.unit) && <SupplementaryBanner what="This algorithm" />}
      {a.explainer ? <ExplainerView a={a} x={a.explainer} /> : <AlgorithmBox a={a} />}
    </>
  );
}

const SECTIONS = ["The problem", "What to know first", "The mathematics", "Where the update comes from", "Pseudocode", "The code that runs it", "A worked example", "Try it, one step at a time", "Strengths and limitations", "Compared with related algorithms", "Practice"];

function ExplainerView({ a, x }: { a: Algorithm; x: Explainer }) {
  // The equations and questions may sit in other chapters; load those too.
  const idx = useContent(cat.withDeps([a.unit, ...x.equations.map((e) => cat.unitOf(e) ?? a.unit), ...questionUnits(a.concept)]));
  const chain = cat.prereqChain(a.concept);
  const qs = idx.questionsFor(a.concept);
  const demo = DEMOS[x.demo];
  const lab = cat.catalog.labs.find((l) => l.slug === x.lab);
  const shown = SECTIONS.map((_, i) => i).filter((i) => i !== 3 || !!x.derivation); // sections on this page, numbered in order
  const sec = (i: number) => ({ id: `x${i + 1}`, "aria-labelledby": `x${i + 1}-h` });
  const H = ({ i }: { i: number }) => (
    <h2 id={`x${i + 1}-h`}>
      <span className="muted">{shown.indexOf(i) + 1}.</span> {SECTIONS[i]}
    </h2>
  );
  return (
    <>
      <nav className="card x-toc" aria-label="On this page">
        <ol>
          {shown.map((i) => (
            <li key={i}>
              <a href={`#x${i + 1}`} onClick={(e) => (e.preventDefault(), document.getElementById(`x${i + 1}`)?.scrollIntoView())}>
                {SECTIONS[i]}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <section className="card" {...sec(0)}>
        <H i={0} />
        <Md text={x.problem} />
        <p className="chips">
          <span className="muted small">Concept:</span> <ConceptLink id={a.concept} />
        </p>
      </section>
      <section className="card" {...sec(1)}>
        <H i={1} />
        {chain.length ? (
          <p>
            Read these first, in this order: {chain.map((c) => <ConceptLink key={c.id} id={c.id} />)}
          </p>
        ) : (
          <p className="muted">No prerequisites in the app.</p>
        )}
      </section>
      <section {...sec(2)}>
        <H i={2} />
        {x.equations.map((e) => {
          const eq = idx.equation(e);
          return eq ? <EquationCard key={e} e={eq} compact /> : <p key={e} className="muted">{e}</p>;
        })}
      </section>
      {x.derivation && (
        <section className="card" {...sec(3)}>
          <H i={3} />
          <ol className="x-derivation">
            {x.derivation.map((d, i) => (
              <li key={i}>
                <Md text={`$$${d.tex}$$`} />
                <MdInline text={d.why} />
              </li>
            ))}
          </ol>
        </section>
      )}
      <section {...sec(4)}>
        <H i={4} />
        <AlgorithmBox a={a} />
      </section>
      <section className="card" {...sec(5)}>
        <H i={5} />
        <SourceView keyName={a.implementation} />
      </section>
      <section className="card" {...sec(6)}>
        <H i={6} />
        <Md text={x.example.text} />
        {x.example.check && <CheckButton id={x.example.check} />}
      </section>
      <section className="card demo" {...sec(7)}>
        <H i={7} />
        <Md text={demo.note} className="muted" />
        {lab && (
          <p className="small">
            The full laboratory, with more problems and settings: <Link to={`/lab/${lab.slug}`}>{lab.title}</Link>
          </p>
        )}
        <div className="demo-body">{demo.view()}</div>
      </section>
      <section className="card" {...sec(8)}>
        <H i={8} />
        <div className="two-col">
          <div>
            <h3>Strengths</h3>
            <ul>
              {x.advantages.map((t, i) => (
                <li key={i}>
                  <MdInline text={t} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Limitations</h3>
            <ul>
              {x.limitations.map((t, i) => (
                <li key={i}>
                  <MdInline text={t} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="card" {...sec(9)}>
        <H i={9} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Compared with</th>
                <th scope="col">The difference</th>
              </tr>
            </thead>
            <tbody>
              {x.comparisons.map((c) => {
                const item = cat.item(c.with);
                return (
                  <tr key={c.with}>
                    <th scope="row">{item ? <Link to={`/algorithm/${c.with}`}>{item.title}</Link> : <ConceptLink id={c.with} />}</th>
                    <td>
                      <MdInline text={c.point} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section {...sec(10)}>
        <H i={10} />
        {qs.length ? (
          <>
            <p>
              {qs.length} question{qs.length === 1 ? "" : "s"} on this concept. <Link to={`/practice?concept=${encodeURIComponent(a.concept)}`}>Practise them in a session</Link>
              {", which records your answers."}
            </p>
            {qs.slice(0, 3).map((q, i) => (
              <QuestionCard key={q.id} q={q} index={i} />
            ))}
          </>
        ) : (
          <p className="muted">No questions on this concept yet.</p>
        )}
      </section>
    </>
  );
}

function CheckButton({ id }: { id: string }) {
  const [ok, setOk] = useState<boolean | null>(null);
  return (
    <p>
      <button type="button" className="btn btn-small" onClick={() => setOk((CHECKS[id] as { run: () => boolean }).run())}>
        {ok === null ? "Check these numbers with the app's code" : "Check again"}
      </button>{" "}
      {ok !== null && <span className={ok ? "ok" : "bad"} role="status">{ok ? "✓ The code reproduces every number above." : "✗ The code does not reproduce these numbers."}</span>}
    </p>
  );
}

function SourceView({ keyName }: { keyName: string }) {
  const [src, setSrc] = useState<{ file: string; code: string } | null | "loading" | "failed">("loading");
  useEffect(() => {
    let live = true;
    loadImplementation(keyName).then((r) => live && setSrc(r), () => live && setSrc("failed"));
    return () => void (live = false);
  }, [keyName]);
  return (
    <>
      <p>
        The labs and the checks call <code>{keyName}</code>. This is its full source, as shipped in the app:
      </p>
      {src === "loading" ? (
        <p className="muted">Loading the source…</p>
      ) : src === "failed" || src === null ? (
        <p className="muted">The source of {keyName} could not be shown.</p>
      ) : (
        <details open>
          <summary>
            <code>{src.file}</code>
          </summary>
          <pre className="code" tabIndex={0} aria-label={`Source of ${keyName}`}>
            <code>{src.code}</code>
          </pre>
        </details>
      )}
    </>
  );
}
