import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { idx } from "../content/bundle";
import { isSupplementaryUnit } from "../content/schema";
import { reviewQueue } from "../domain/progress";
import { useProgress } from "../store/ProgressContext";
import { AlgorithmBox, EquationCard } from "../components/items";
import { QuestionCard } from "../components/QuestionCard";
import { Badge, Empty, Md, MdInline, PageTitle, Sources, Tex } from "../components/ui";

export function RevisionHub() {
  const { data } = useProgress();
  const now = Date.now();
  const queue = reviewQueue(data, idx.cardIds(), now);
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
          <span>{idx.bundle.equations.length} equations</span>
        </Link>
        <Link className="tile" to="/revision/algorithms">
          <strong>Algorithms</strong>
          <span>{idx.bundle.algorithms.length} pseudocode boxes</span>
        </Link>
        <Link className="tile" to="/revision/notation">
          <strong>Notation</strong>
          <span>{idx.bundle.notation.length} symbols</span>
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
                <Link to={`/concept/${id}`}>{idx.concept(id)?.title ?? id}</Link>
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

export function EquationLibrary() {
  const [unit, setUnit] = useState("all");
  const units = [...new Set(idx.bundle.equations.map((e) => e.unit))];
  const list = idx.bundle.equations.filter((e) => unit === "all" || e.unit === unit);
  return (
    <>
      <p className="crumb">
        <Link to="/revision">Revise</Link> / equations
      </p>
      <PageTitle title="Equation library">Equation library</PageTitle>
      <label>
        Show{" "}
        <select value={unit} onChange={(e) => setUnit(e.target.value)}>
          <option value="all">all chapters</option>
          {units.map((u) => (
            <option key={u} value={u}>
              {idx.unit(u)?.kind === "core" ? `Chapter ${idx.unit(u)!.core!.chapter}` : `${idx.unit(u)?.title} (supplementary)`}
            </option>
          ))}
        </select>
      </label>
      {list.map((e) => (
        <EquationCard key={e.id} e={e} compact />
      ))}
    </>
  );
}

export function AlgorithmLibrary() {
  return (
    <>
      <p className="crumb">
        <Link to="/revision">Revise</Link> / algorithms
      </p>
      <PageTitle title="Algorithms">Algorithms</PageTitle>
      {idx.bundle.algorithms.length ? idx.bundle.algorithms.map((a) => <AlgorithmBox key={a.id} a={a} />) : <Empty>No algorithms yet.</Empty>}
    </>
  );
}

export function NotationPage() {
  const { data } = useProgress();
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
          {idx.bundle.notation.map((n) => (
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
  const [queue] = useState(() => reviewQueue(data, idx.cardIds(), Date.now()));
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
            <CardFace id={current.id} flipped={flipped} />
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
