import { Suspense, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { cat, useContent } from "../content/load";
import type { ItemKind } from "../content/catalog";
import { isSupplementaryUnit } from "../content/schema";
import { reviewQueue } from "../domain/progress";
import { useProgress } from "../store/ProgressContext";
import { AlgorithmBox, EquationCard } from "../components/items";
import { QuestionCard } from "../components/QuestionCard";
import { Badge, Empty, PageTitle, Sources } from "../components/ui";
import { Md, MdInline, Tex } from "../components/math";

export function RevisionHub() {
  const { data } = useProgress();
  const now = Date.now();
  const queue = reviewQueue(data, cat.cardIds(), now);
  const due = queue.filter((c) => !c.isNew).length;
  const needs = Object.entries(data.conceptStatus).filter(([, s]) => s.status === "needs-revision").map(([id]) => id);
  return (
    <>
      <PageTitle title="Revise">Revise</PageTitle>
      <div className="tiles">
        <Link className="tile" to="/revision/review">
          <strong>Spaced review</strong>
          <span>
            {due} due · {queue.length - due} new available
          </span>
        </Link>
        <Link className="tile" to="/revision/equations">
          <strong>Equation library</strong>
          <span>{cat.itemsOf("equation").length} equations</span>
        </Link>
        <Link className="tile" to="/revision/algorithms">
          <strong>Algorithms</strong>
          <span>{cat.itemsOf("algorithm").length} pseudocode boxes</span>
        </Link>
        <Link className="tile" to="/revision/notation">
          <strong>Notation</strong>
          <span>{cat.catalog.notationCount} symbols</span>
        </Link>
        <Link className="tile" to="/revision/marked">
          <strong>Marked questions</strong>
          <span>{data.marked.length} marked</span>
        </Link>
      </div>
      <section className="card">
        <h2>Concepts you marked “Needs revision”</h2>
        {needs.length ? (
          <ul className="list">
            {needs.map((id) => (
              <li key={id}>
                <Link to={`/concept/${id}`}>{cat.concept(id)?.title ?? id}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>None. Set a concept's status to “Needs revision” on its page to collect it here.</Empty>
        )}
      </section>
    </>
  );
}

const CORE = "core";
const EVERYTHING = "everything";
/** Which units a library shows. Supplementary units are fetched only when the learner picks them. */
function scopeUnits(kind: ItemKind, scope: string): string[] {
  const units = [...new Set(cat.itemsOf(kind).map((i) => i.unit))];
  if (scope === CORE) return units.filter((u) => !isSupplementaryUnit(u));
  if (scope === EVERYTHING) return units;
  return units.filter((u) => u === scope);
}
const unitLabel = (u: string) => (cat.unit(u)?.kind === "core" ? `Chapter ${cat.unit(u)!.core!.chapter}` : `${cat.unit(u)?.title} (supplementary)`);

function ScopeSelect({ kind, value, onChange }: { kind: ItemKind; value: string; onChange: (v: string) => void }) {
  const units = [...new Set(cat.itemsOf(kind).map((i) => i.unit))];
  return (
    <label>
      Show{" "}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={CORE}>all 2015-draft chapters</option>
        {units.map((u) => (
          <option key={u} value={u}>
            {unitLabel(u)}
          </option>
        ))}
        <option value={EVERYTHING}>everything, including supplementary</option>
      </select>
    </label>
  );
}

function EquationList({ scope }: { scope: string }) {
  const units = scopeUnits("equation", scope);
  const idx = useContent(units);
  const list = idx.bundle.equations.filter((e) => units.includes(e.unit));
  return list.length ? list.map((e) => <EquationCard key={e.id} e={e} compact />) : <Empty>No equations here yet.</Empty>;
}

export function EquationLibrary() {
  const [scope, setScope] = useState(CORE);
  return (
    <>
      <p className="crumb">
        <Link to="/revision">Revise</Link> / equations
      </p>
      <PageTitle title="Equation library">Equation library</PageTitle>
      <ScopeSelect kind="equation" value={scope} onChange={setScope} />
      <Suspense fallback={<p className="muted" role="status">Loading equations…</p>}>
        <EquationList scope={scope} />
      </Suspense>
    </>
  );
}

function AlgorithmList({ scope }: { scope: string }) {
  const units = scopeUnits("algorithm", scope);
  const idx = useContent(units);
  const list = idx.bundle.algorithms.filter((a) => units.includes(a.unit));
  return list.length ? list.map((a) => <AlgorithmBox key={a.id} a={a} />) : <Empty>No algorithms yet.</Empty>;
}

export function AlgorithmLibrary() {
  const [scope, setScope] = useState(CORE);
  return (
    <>
      <p className="crumb">
        <Link to="/revision">Revise</Link> / algorithms
      </p>
      <PageTitle title="Algorithms">Algorithms</PageTitle>
      <ScopeSelect kind="algorithm" value={scope} onChange={setScope} />
      <Suspense fallback={<p className="muted" role="status">Loading algorithms…</p>}>
        <AlgorithmList scope={scope} />
      </Suspense>
    </>
  );
}

export function NotationPage() {
  const { data } = useProgress();
  const notation = useContent([], true).bundle.notation;
  const [params] = useSearchParams();
  const focus = params.get("focus");
  useEffect(() => {
    if (focus) document.getElementById(`n-${focus}`)?.scrollIntoView({ block: "center" });
  }, [focus]);
  return (
    <>
      <p className="crumb">
        <Link to="/revision">Revise</Link> / notation
      </p>
      <PageTitle title="Notation">Notation of the 2015 draft</PageTitle>
      <p className="muted">
        As in the draft's Summary of Notation (printed pp. xiii–xiv, PDF 13–14), plus symbols the draft uses but does not list.
        {data.settings.show2018Notation ? " Cross-references to the 2018 edition are shown; they are unverified." : " Turn on 2018-edition cross-references in Settings."}
      </p>
      <table className="notation">
        <thead>
          <tr>
            <th scope="col">Symbol</th>
            <th scope="col">Meaning</th>
            {data.settings.show2018Notation && <th scope="col">2018 edition</th>}
            <th scope="col">Where</th>
          </tr>
        </thead>
        <tbody>
          {notation.map((n) => (
            <tr key={n.id} id={`n-${n.id}`} className={focus === n.id ? "focus" : ""}>
              <td>
                <Tex tex={n.tex} />
              </td>
              <td>
                <MdInline text={n.meaning} />
              </td>
              {data.settings.show2018Notation && (
                <td>
                  {n.tex2018 ? (
                    <>
                      <Tex tex={n.tex2018} /> <Badge tone="warn">unverified</Badge>
                      <div className="muted small">{n.note2018}</div>
                    </>
                  ) : (
                    <span className="muted">same</span>
                  )}
                </td>
              )}
              <td className="small">
                <Sources refs={n.sources} label="" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** Front and back of a revision card: concepts show their summary, equations their formula. */
function CardFace({ id, flipped }: { id: string; flipped: boolean }) {
  const key = id.replace(/^card:/, "");
  const unit = cat.unitOf(key);
  const idx = useContent(unit ? [unit] : []);
  const c = idx.concept(key);
  const e = idx.equation(key);
  if (c)
    return (
      <>
        <p className="card-kind">Concept {isSupplementaryUnit(c.unit) && <Badge tone="sup">Supplementary</Badge>}</p>
        <h2>{c.title}</h2>
        {flipped ? <Md text={c.summary} /> : <p className="muted">What is it, and why does it matter?</p>}
        {flipped && <Sources refs={c.sources} />}
      </>
    );
  if (e)
    return (
      <>
        <p className="card-kind">Equation {e.bookLabel}</p>
        <h2>{e.name}</h2>
        {flipped ? (
          <>
            <Tex tex={e.tex} display />
            <p>
              <MdInline text={e.intuition} />
            </p>
            <Sources refs={e.sources} />
          </>
        ) : (
          <p className="muted">Write the equation and say what each symbol means.</p>
        )}
      </>
    );
  return <p className="muted">Unknown card {id}</p>;
}

const GRADES: [0 | 1 | 2 | 3, string][] = [
  [0, "Forgot"],
  [1, "Hard"],
  [2, "Good"],
  [3, "Easy"],
];

export function ReviewPage() {
  const { data, reviewCard } = useProgress();
  // The queue is fixed when the page opens, so grading a card does not reshuffle the session.
  const [queue] = useState(() => reviewQueue(data, cat.cardIds(), Date.now()));
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const current = queue[i];
  const grade = useMemo(
    () => (g: 0 | 1 | 2 | 3) => {
      if (!current) return;
      reviewCard(current.id, g);
      setFlipped(false);
      setI((n) => n + 1);
    },
    [current, reviewCard],
  );
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement || ev.target instanceof HTMLTextAreaElement) return;
      if (ev.key === " " && current) {
        ev.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ["1", "2", "3", "4"].includes(ev.key)) grade((Number(ev.key) - 1) as 0 | 1 | 2 | 3);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [current, flipped, grade]);
  return (
    <>
      <p className="crumb">
        <Link to="/revision">Revise</Link> / spaced review
      </p>
      <PageTitle title="Spaced review">Spaced review</PageTitle>
      {!current ? (
        <Empty>
          {queue.length ? `Session complete: ${queue.length} card${queue.length > 1 ? "s" : ""} reviewed.` : "Nothing is due and there are no new cards."}{" "}
          <Link to="/revision">Back to revision</Link>
        </Empty>
      ) : (
        <>
          <p className="muted">
            Card {i + 1} of {queue.length} {current.isNew && <Badge>new</Badge>}. Keyboard: Space flips; 1–4 grade.
          </p>
          <div className={`flashcard ${flipped ? "flipped" : ""}`} aria-live="polite">
            <Suspense fallback={<p className="muted" role="status">Loading card…</p>}>
              <CardFace id={current.id} flipped={flipped} />
            </Suspense>
          </div>
          {!flipped ? (
            <button type="button" className="btn btn-primary" onClick={() => setFlipped(true)}>
              Show answer
            </button>
          ) : (
            <div className="actions" role="group" aria-label="How well did you recall it?">
              {GRADES.map(([g, label]) => (
                <button key={g} type="button" className="btn" onClick={() => grade(g)}>
                  {g + 1} · {label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

export function MarkedQuestions() {
  const { data } = useProgress();
  // Units are fixed when the page opens, so un-marking a question does not reload the page.
  const [units] = useState(() => [...new Set(data.marked.map((id) => cat.question(id)?.unit).filter((u): u is string => !!u))]);
  const idx = useContent(units);
  const qs = data.marked.map((id) => idx.question(id)).filter((q) => q !== undefined);
  return (
    <>
      <p className="crumb">
        <Link to="/revision">Revise</Link> / marked
      </p>
      <PageTitle title="Marked questions">Marked questions</PageTitle>
      {qs.length ? qs.map((q, i) => <QuestionCard key={q.id} q={q} index={i} />) : <Empty>No questions are marked. Use “Mark for revision” on any exercise.</Empty>}
    </>
  );
}
