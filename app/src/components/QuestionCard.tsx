// One question inside a lesson or concept page: collects the answer, grades it with domain/answer.ts and
// records the attempt. Practice and mock exams use the same parts (components/question.tsx).
import { useMemo, useState } from "react";
import type { Question } from "../content/schema";
import { emptyDraft, gradeDraft, isSelfMarked, type Draft } from "../domain/answer";
import type { Grade } from "../domain/grade";
import { accuracyOf } from "../domain/progress";
import { useProgress } from "../store/ProgressContext";
import { Md } from "./math";
import { AnswerInput, QuestionHeader, RubricMarker, Solution, Verdict } from "./question";

export { ProvenanceBadge } from "./question";

export function QuestionCard({ q, index }: { q: Question; index?: number }) {
  const { data, attempt, toggleMark, toggleBookmark } = useProgress();
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(q));
  const [grade, setGrade] = useState<Grade | null>(null);
  const [shown, setShown] = useState(false);
  const history = useMemo(() => accuracyOf(data.attempts.filter((a) => a.qid === q.id)), [data.attempts, q.id]);
  const marked = data.marked.includes(q.id);
  const bookmarked = data.bookmarks.includes(q.id);
  const self = isSelfMarked(q);

  const record = (d: Draft) => {
    const g = gradeDraft(q, d);
    setGrade(g);
    setShown(true);
    attempt({ qid: q.id, unit: q.unit, concepts: q.concepts, score: g.score, max: g.max, mode: "lesson", ...(self ? { selfMarked: true } : {}) });
  };
  const selfReady = q.rubric?.length ? true : draft.selfScore !== null;

  return (
    <article className="item question" id={q.id} aria-labelledby={`${q.id}-h`}>
      <QuestionHeader q={q} id={`${q.id}-h`} label={index !== undefined ? `Question ${index + 1}` : "Question"} />
      <Md text={q.stem} />
      <AnswerInput q={q} draft={draft} onChange={setDraft} locked={shown} showKey={shown && !self} grade={grade} name={`q-${q.id}`} />
      {self && shown && !grade && <RubricMarker q={q} draft={draft} onChange={setDraft} />}

      <div className="actions">
        {!shown ? (
          self ? (
            <button type="button" className="btn btn-primary" onClick={() => setShown(true)}>
              Show model answer
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => record(draft)}>
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
              setDraft(emptyDraft(q));
            }}
          >
            Try again
          </button>
        )}
        {self && shown && !grade && (
          <button type="button" className="btn btn-primary" onClick={() => record(draft)} disabled={!selfReady}>
            Record my mark
          </button>
        )}
        <button type="button" className="btn" aria-pressed={marked} onClick={() => toggleMark(q.id)}>
          {marked ? "★ Marked for revision" : "☆ Mark for revision"}
        </button>
        <button type="button" className="btn" aria-pressed={bookmarked} onClick={() => toggleBookmark(q.id)}>
          {bookmarked ? "Bookmarked" : "Bookmark"}
        </button>
      </div>

      {shown && (
        <div className="feedback" role="status">
          {grade && <Verdict grade={grade} selfMarked={self} />}
          <Solution q={q} />
        </div>
      )}
      <p className="muted small">{history.attempts ? `${history.attempts} attempt${history.attempts > 1 ? "s" : ""}, ${Math.round((history.accuracy ?? 0) * 100)}% of marks so far` : "Not attempted yet"}</p>
    </article>
  );
}
