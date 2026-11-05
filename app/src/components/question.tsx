// The parts of a question on screen, shared by lesson cards (QuestionCard), Practice and mock exams.
// Presentation only: drafts and grades come from domain/answer.ts and domain/grade.ts.
import type { ReactNode } from "react";
import type { Question } from "../content/schema";
import { DIFFICULTY_LABEL, PROVENANCE_LABEL, isSupplementaryUnit } from "../content/schema";
import { isSelfMarked, moveStep, type Draft } from "../domain/answer";
import type { Grade } from "../domain/grade";
import { Badge, Sources } from "./ui";
import { Md, MdInline } from "./math";

export const TYPE_LABEL: Record<Question["type"], string> = {
  mcq: "Choose one",
  multi: "Select all that apply",
  numeric: "Numerical",
  "multi-numeric": "Numerical, several parts",
  ordering: "Put in order",
  "true-false": "True or false",
  derivation: "Derivation",
  "short-answer": "Short answer",
};

/** Says plainly where the question comes from; a generated question is never presented as a textbook one. */
export function ProvenanceBadge({ q }: { q: Question }) {
  const p = q.provenance;
  if (p.kind === "supplementary") return null; // the Supplementary badge already says it
  if (p.kind === "textbook-exercise") return <Badge tone="core" title="Reworded from the April 2015 draft; see the cited page for the original">Exercise {p.exercise}, reworded</Badge>;
  const basis = p.basis?.length ? `Based on ${p.basis.join(", ")}` : undefined;
  return <Badge tone={p.kind === "textbook-derived" ? "core" : "neutral"} title={basis}>{PROVENANCE_LABEL[p.kind]}</Badge>;
}

export function QuestionHeader({ q, label, id, extra }: { q: Question; label: string; id?: string; extra?: ReactNode }) {
  return (
    <header className="item-head">
      <span className="item-kind" id={id}>
        {label} · {TYPE_LABEL[q.type]}
      </span>
      <Badge>{DIFFICULTY_LABEL[q.difficulty]}</Badge>
      <Badge>
        {q.marks} mark{q.marks === 1 ? "" : "s"}
      </Badge>
      <ProvenanceBadge q={q} />
      {isSupplementaryUnit(q.unit) && <Badge tone="sup">Supplementary</Badge>}
      {extra}
    </header>
  );
}

interface InputProps {
  q: Question;
  draft: Draft;
  onChange: (d: Draft) => void;
  locked: boolean; // answer can no longer change
  showKey: boolean; // mark right and wrong, show the key
  grade: Grade | null;
  name: string; // unique per rendered question (radio groups)
}

/** The answer controls for every question type. Self-marked types get a free-text box for the learner's own working. */
export function AnswerInput({ q, draft, onChange, locked, showKey, grade, name }: InputProps) {
  const set = (p: Partial<Draft>) => onChange({ ...draft, ...p, touched: true });
  switch (q.type) {
    case "mcq":
      return (
        <fieldset className="opts">
          <legend className="sr-only">Options</legend>
          {q.options!.map((o, i) => (
            <label key={i} className={`opt ${showKey && i === q.answer ? "correct" : ""} ${showKey && draft.choice === i && i !== q.answer ? "wrong" : ""}`}>
              <input type="radio" name={name} checked={draft.choice === i} onChange={() => set({ choice: i })} disabled={locked} /> <MdInline text={o} />
            </label>
          ))}
        </fieldset>
      );
    case "multi":
      return (
        <fieldset className="opts">
          <legend className="sr-only">Options</legend>
          {q.options!.map((o, i) => {
            const right = (q.answer as number[]).includes(i);
            return (
              <label key={i} className={`opt ${showKey && right ? "correct" : ""} ${showKey && !right && draft.choices.includes(i) ? "wrong" : ""}`}>
                <input
                  type="checkbox"
                  checked={draft.choices.includes(i)}
                  disabled={locked}
                  onChange={(e) => set({ choices: e.target.checked ? [...draft.choices, i].sort((a, b) => a - b) : draft.choices.filter((x) => x !== i) })}
                />{" "}
                <MdInline text={o} />
              </label>
            );
          })}
        </fieldset>
      );
    case "true-false":
      return (
        <fieldset className="opts row">
          <legend className="sr-only">True or false</legend>
          {[true, false].map((v) => (
            <label key={String(v)} className={`opt ${showKey && v === q.answer ? "correct" : ""}`}>
              <input type="radio" name={name} checked={draft.tf === v} onChange={() => set({ tf: v })} disabled={locked} /> {v ? "True" : "False"}
            </label>
          ))}
        </fieldset>
      );
    case "numeric":
    case "multi-numeric":
      return (
        <div className="parts">
          {q.parts!.map((p, i) => (
            <label key={i} className={showKey ? (grade?.parts?.[i] ? "part ok" : "part bad") : "part"}>
              <span>
                <MdInline text={p.label} />
              </span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={draft.texts[i]}
                disabled={locked}
                placeholder="e.g. 0.25 or 1/4"
                onChange={(e) => set({ texts: draft.texts.map((x, j) => (j === i ? e.target.value : x)) })}
              />
              {showKey && (
                <span className="key">
                  answer {p.answer}
                  {p.tolerance > 0 ? ` (± ${p.tolerance})` : ""}
                </span>
              )}
            </label>
          ))}
        </div>
      );
    case "ordering":
      return (
        <ol className="ordering">
          {draft.order.map((opt, i) => (
            <li key={opt} className={showKey ? (grade?.parts?.[i] ? "ok" : "bad") : ""}>
              <span className="ord-text">
                <MdInline text={q.options![opt]} />
              </span>
              {!locked && (
                <span className="ord-btns">
                  <button type="button" className="btn btn-small" onClick={() => onChange(moveStep(draft, i, -1))} disabled={i === 0} aria-label={`Move step ${i + 1} up`}>
                    ↑
                  </button>
                  <button type="button" className="btn btn-small" onClick={() => onChange(moveStep(draft, i, 1))} disabled={i === draft.order.length - 1} aria-label={`Move step ${i + 1} down`}>
                    ↓
                  </button>
                </span>
              )}
            </li>
          ))}
        </ol>
      );
    case "derivation":
    case "short-answer":
      return (
        <label className="freetext">
          <span>Your answer (kept on this device; you mark it yourself against the model answer)</span>
          <textarea rows={q.type === "derivation" ? 6 : 3} value={draft.text} disabled={locked} onChange={(e) => set({ text: e.target.value })} />
        </label>
      );
  }
}

/** Self-marking: tick each rubric point met (or give one mark when there is no rubric). The app never grades free text. */
export function RubricMarker({ q, draft, onChange, disabled }: { q: Question; draft: Draft; onChange: (d: Draft) => void; disabled?: boolean }) {
  if (!isSelfMarked(q)) return null;
  if (!q.rubric?.length)
    return (
      <label className="part">
        <span>Mark your own work out of {q.marks}</span>
        <input
          type="number"
          min={0}
          max={q.marks}
          value={draft.selfScore ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...draft, selfScore: e.target.value === "" ? null : Number(e.target.value), touched: true })}
        />
      </label>
    );
  const got = q.rubric.reduce((t, p, i) => t + (draft.ticks[i] ? p.marks : 0), 0);
  return (
    <fieldset className="rubric">
      <legend>Mark your answer: tick each point your answer makes</legend>
      {q.rubric.map((p, i) => (
        <label key={i} className="check">
          <input
            type="checkbox"
            checked={!!draft.ticks[i]}
            disabled={disabled}
            onChange={(e) => onChange({ ...draft, ticks: q.rubric!.map((_, j) => (j === i ? e.target.checked : !!draft.ticks[j])), touched: true })}
          />{" "}
          <MdInline text={p.point} />{" "}
          <span className="muted small">
            ({p.marks} mark{p.marks === 1 ? "" : "s"})
          </span>
        </label>
      ))}
      <p className="muted small" role="status">
        Your mark: {got} / {q.marks}
      </p>
    </fieldset>
  );
}

export function Verdict({ grade, selfMarked }: { grade: Grade; selfMarked?: boolean }) {
  return (
    <p className={`verdict ${grade.correct ? "ok" : grade.score > 0 ? "part" : "bad"}`}>
      {grade.correct ? "Correct" : grade.score > 0 ? "Partly correct" : "Not correct"}: {grade.score} / {grade.max}
      {selfMarked ? " (your own mark)" : ""}
    </p>
  );
}

/**
 * The worked solution. With `stepwise`, steps are revealed one at a time (`steps` shown so far); the
 * explanation, model answer, option notes and misconceptions appear once every step is visible.
 */
export function Solution({ q, steps, stepwise, onStep, onAll }: { q: Question; steps?: number; stepwise?: boolean; onStep?: () => void; onAll?: () => void }) {
  const shown = stepwise ? Math.min(steps ?? 0, q.solution.length) : q.solution.length;
  const complete = shown >= q.solution.length;
  return (
    <div className="solution-block">
      {isSelfMarked(q) && typeof q.answer === "string" && (
        <div className="model-answer">
          <h4>Model answer</h4>
          <Md text={q.answer} />
        </div>
      )}
      <h4>Solution</h4>
      {shown > 0 && (
        <ol className="solution">
          {q.solution.slice(0, shown).map((s, i) => (
            <li key={i}>
              <Md text={s} />
            </li>
          ))}
        </ol>
      )}
      {!complete && (
        <div className="actions">
          <button type="button" className="btn" onClick={onStep}>
            Show next step ({shown + 1} of {q.solution.length})
          </button>
          <button type="button" className="btn" onClick={onAll}>
            Show all steps
          </button>
        </div>
      )}
      {complete && (
        <>
          <Md text={q.explanation} className="muted" />
          {q.optionNotes && (
            <ul className="option-notes">
              {q.optionNotes.map((n, i) => (
                <li key={i}>
                  <MdInline text={q.options![i]} />: <MdInline text={n} />
                </li>
              ))}
            </ul>
          )}
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
        </>
      )}
    </div>
  );
}
