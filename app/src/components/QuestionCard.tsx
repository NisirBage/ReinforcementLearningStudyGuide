// One practice question: collects the response, grades it with domain/grade.ts, records the attempt.
import { useMemo, useState } from "react";
import type { Question } from "../content/schema";
import { DIFFICULTY_LABEL, PROVENANCE_LABEL, SELF_MARKED_TYPES, isSupplementaryUnit } from "../content/schema";
import { gradeQuestion, parseNumber, type Grade, type Response } from "../domain/grade";
import { accuracyOf } from "../domain/progress";
import { makeRng, shuffle } from "../domain/random";
import { useProgress } from "../store/ProgressContext";
import { Badge, Sources } from "./ui";
import { Md, MdInline } from "./math";

const TYPE_LABEL: Record<Question["type"], string> = {
  mcq: "Choose one",
  multi: "Select all that apply",
  numeric: "Numerical",
  "multi-numeric": "Numerical, several parts",
  ordering: "Put in order",
  "true-false": "True or false",
  derivation: "Derivation",
  "short-answer": "Short answer",
};

const isSelfMarked = (q: Question) => (SELF_MARKED_TYPES as readonly string[]).includes(q.type);

/** Says plainly where the question comes from; a generated question is never presented as a textbook one. */
export function ProvenanceBadge({ q }: { q: Question }) {
  const p = q.provenance;
  if (p.kind === "supplementary") return null; // the Supplementary badge already says it
  if (p.kind === "textbook-exercise") return <Badge tone="core" title="Reworded from the April 2015 draft; see the cited page for the original">Exercise {p.exercise}, reworded</Badge>;
  const basis = p.basis?.length ? `Based on ${p.basis.join(", ")}` : undefined;
  return <Badge tone={p.kind === "textbook-derived" ? "core" : "neutral"} title={basis}>{PROVENANCE_LABEL[p.kind]}</Badge>;
}

/** A stable, per-question shuffle so ordering questions never start already solved. */
const scrambled = (q: Question) => {
  const n = q.options!.length;
  let order = shuffle([...Array(n).keys()], makeRng([...q.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)));
  if (order.every((v, i) => v === i)) order = [...order.slice(1), order[0]];
  return order;
};

export function QuestionCard({ q, index }: { q: Question; index?: number }) {
  const { data, attempt, toggleMark } = useProgress();
  const [choice, setChoice] = useState<number | null>(null);
  const [choices, setChoices] = useState<number[]>([]);
  const [tf, setTf] = useState<boolean | null>(null);
  const [texts, setTexts] = useState<string[]>(() => (q.parts ?? []).map(() => ""));
  const [order, setOrder] = useState<number[]>(() => (q.type === "ordering" ? scrambled(q) : []));
  const [self, setSelf] = useState<number | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [shown, setShown] = useState(false);
  const history = useMemo(() => accuracyOf(data.attempts.filter((a) => a.qid === q.id)), [data.attempts, q.id]);
  const marked = data.marked.includes(q.id);
  const name = `q-${q.id}`;

  const response = (): Response => {
    switch (q.type) {
      case "mcq":
        return { type: "mcq", choice };
      case "multi":
        return { type: "multi", choices };
      case "true-false":
        return { type: "true-false", value: tf };
      case "numeric":
      case "multi-numeric":
        return { type: "numeric", values: texts.map(parseNumber) };
      case "ordering":
        return { type: "ordering", order };
      case "derivation":
      case "short-answer":
        return { type: "derivation", selfScore: self };
    }
  };
  const submit = () => {
    const g = gradeQuestion(q, response());
    setGrade(g);
    setShown(true);
    attempt({ qid: q.id, unit: q.unit, concepts: q.concepts, score: g.score, max: g.max, mode: "lesson", ...(isSelfMarked(q) ? { selfMarked: true } : {}) });
  };
  const move = (i: number, d: -1 | 1) =>
    setOrder((o) => {
      const j = i + d;
      if (j < 0 || j >= o.length) return o;
      const n = [...o];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <article className="item question" id={q.id} aria-labelledby={`${q.id}-h`}>
      <header className="item-head">
        <span className="item-kind" id={`${q.id}-h`}>
          {index !== undefined ? `Question ${index + 1}` : "Question"} · {TYPE_LABEL[q.type]}
        </span>
        <Badge>{DIFFICULTY_LABEL[q.difficulty]}</Badge>
        <Badge>{q.marks} mark{q.marks === 1 ? "" : "s"}</Badge>
        <ProvenanceBadge q={q} />
        {isSupplementaryUnit(q.unit) && <Badge tone="sup">Supplementary</Badge>}
      </header>
      <Md text={q.stem} />

      {q.type === "mcq" && (
        <fieldset className="opts">
          <legend className="sr-only">Options</legend>
          {q.options!.map((o, i) => (
            <label key={i} className={`opt ${shown && i === q.answer ? "correct" : ""}`}>
              <input type="radio" name={name} checked={choice === i} onChange={() => setChoice(i)} disabled={shown} /> <MdInline text={o} />
            </label>
          ))}
        </fieldset>
      )}
      {q.type === "multi" && (
        <fieldset className="opts">
          <legend className="sr-only">Options</legend>
          {q.options!.map((o, i) => (
            <label key={i} className={`opt ${shown && (q.answer as number[]).includes(i) ? "correct" : ""}`}>
              <input
                type="checkbox"
                checked={choices.includes(i)}
                disabled={shown}
                onChange={(e) => setChoices((c) => (e.target.checked ? [...c, i] : c.filter((x) => x !== i)))}
              />{" "}
              <MdInline text={o} />
            </label>
          ))}
        </fieldset>
      )}
      {q.type === "true-false" && (
        <fieldset className="opts row">
          <legend className="sr-only">True or false</legend>
          {[true, false].map((v) => (
            <label key={String(v)} className={`opt ${shown && v === q.answer ? "correct" : ""}`}>
              <input type="radio" name={name} checked={tf === v} onChange={() => setTf(v)} disabled={shown} /> {v ? "True" : "False"}
            </label>
          ))}
        </fieldset>
      )}
      {(q.type === "numeric" || q.type === "multi-numeric") && (
        <div className="parts">
          {q.parts!.map((p, i) => (
            <label key={i} className={shown ? (grade?.parts?.[i] ? "part ok" : "part bad") : "part"}>
              <span>
                <MdInline text={p.label} />
              </span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={texts[i]}
                disabled={shown}
                placeholder="e.g. 0.25 or 1/4"
                onChange={(e) => setTexts((t) => t.map((x, j) => (j === i ? e.target.value : x)))}
              />
              {shown && <span className="key">answer {p.answer}</span>}
            </label>
          ))}
        </div>
      )}
      {q.type === "ordering" && (
        <ol className="ordering">
          {order.map((opt, i) => (
            <li key={opt} className={shown ? (grade?.parts?.[i] ? "ok" : "bad") : ""}>
              <span className="ord-text">
                <MdInline text={q.options![opt]} />
              </span>
              {!shown && (
                <span className="ord-btns">
                  <button type="button" className="btn btn-small" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move step ${i + 1} up`}>
                    ↑
                  </button>
                  <button type="button" className="btn btn-small" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`Move step ${i + 1} down`}>
                    ↓
                  </button>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      {isSelfMarked(q) && shown && (
        <label className="part">
          <span>Mark your own work out of {q.marks}</span>
          <input type="number" min={0} max={q.marks} value={self ?? ""} onChange={(e) => setSelf(e.target.value === "" ? null : Number(e.target.value))} />
        </label>
      )}

      <div className="actions">
        {!shown ? (
          isSelfMarked(q) ? (
            <button type="button" className="btn btn-primary" onClick={() => setShown(true)}>
              Show model answer
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={submit}>
              Check answer
            </button>
          )
        ) : (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setShown(false);
              setGrade(null);
              setChoice(null);
              setChoices([]);
              setTf(null);
              setTexts((q.parts ?? []).map(() => ""));
              if (q.type === "ordering") setOrder(scrambled(q));
            }}
          >
            Try again
          </button>
        )}
        {isSelfMarked(q) && shown && !grade && (
          <button type="button" className="btn btn-primary" onClick={submit} disabled={self === null}>
            Record my mark
          </button>
        )}
        <button type="button" className="btn" aria-pressed={marked} onClick={() => toggleMark(q.id)}>
          {marked ? "★ Marked for revision" : "☆ Mark for revision"}
        </button>
      </div>

      {shown && (
        <div className="feedback" role="status">
          {grade && (
            <p className={`verdict ${grade.correct ? "ok" : "bad"}`}>
              {grade.correct ? "Correct" : grade.score > 0 ? "Partly correct" : "Not correct"}: {grade.score} / {grade.max}
            </p>
          )}
          {isSelfMarked(q) && typeof q.answer === "string" && <Md text={q.answer} />}
          {q.optionNotes && (
            <ul className="option-notes">
              {q.optionNotes.map((n, i) => (
                <li key={i}>
                  <MdInline text={q.options![i]} />: <MdInline text={n} />
                </li>
              ))}
            </ul>
          )}
          <h4>Solution</h4>
          <ol className="solution">
            {q.solution.map((s, i) => (
              <li key={i}>
                <Md text={s} />
              </li>
            ))}
          </ol>
          <Md text={q.explanation} className="muted" />
          {q.misconceptions?.length ? (
            <div className="pitfalls">
              <h4>Common misconceptions</h4>
              <ul>
                {q.misconceptions.map((m, i) => (
                  <li key={i}>
                    <MdInline text={`**${m.wrong}.** ${m.why}`} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Sources refs={q.sources} />
        </div>
      )}
      <p className="muted small">{history.attempts ? `${history.attempts} attempt${history.attempts > 1 ? "s" : ""}, ${Math.round((history.accuracy ?? 0) * 100)}% of marks so far` : "Not attempted yet"}</p>
    </article>
  );
}
