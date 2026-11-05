// Mock examinations: setup, the timed exam, results and history. Timing, grading and every result come from
// domain/exam.ts; this file only connects them to the screen, to IndexedDB and to the progress record.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { cat, fetchIndexes, peekIndexes, useContent } from "../content/load";
import type { Indexes } from "../content/indexes";
import { DIFFICULTY_LABEL, isSupplementaryUnit, type Question } from "../content/schema";
import { gradeDraft, isAnswered, isSelfMarked, type Draft } from "../domain/answer";
import {
  MAX_MINUTES, MIN_MINUTES, examCounts, examQuestions, examResults, formatClock, goTo, isActiveExam, isExpired, markExamItem, questionState,
  remainingMs, resumeExam, setAnswer, startExam, submitExam, toggleReview, type ActiveExam, type Breakdown, type ExamConfig,
} from "../domain/exam";
import type { ExamRecord } from "../domain/progress";
import { randomSeed } from "../domain/random";
import { useProgress } from "../store/ProgressContext";
import { Loading } from "../components/Boundary";
import { AnswerInput, QuestionHeader, RubricMarker, Solution, TYPE_LABEL, Verdict } from "../components/question";
import { Md } from "../components/math";
import { Badge, Empty, PageTitle, Stat, pct } from "../components/ui";
import { NotFound } from "./NotFound";

const SLOT = "exam";
const unitOrder = () => cat.units.map((u) => u.id);
const unitName = (u: string) => (cat.unit(u)?.kind === "core" ? `Chapter ${cat.unit(u)!.core!.chapter}: ${cat.unit(u)!.title}` : cat.unit(u)?.title ?? u);
const shortUnit = (u: string) => (cat.unit(u)?.kind === "core" ? `Chapter ${cat.unit(u)!.core!.chapter}` : cat.unit(u)?.title ?? u);

export function ExamPage() {
  const { slot, ready, setExamDeadline } = useProgress();
  const [loaded, setLoaded] = useState(false);
  const [exam, setExam] = useState<ActiveExam | null>(null);
  useEffect(() => {
    let live = true;
    slot.load(SLOT).then((v) => {
      if (!live) return;
      if (isActiveExam(v) && v.qids.every((id) => cat.question(id))) setExam(v);
      else if (v !== undefined) slot.clear(SLOT); // unreadable or out of date: dropped
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [slot]);
  const update = (e: ActiveExam | null) => {
    setExam(e);
    if (e) slot.save(SLOT, e);
    else slot.clear(SLOT);
    setExamDeadline(e ? e.deadline : null);
  };
  if (!ready || !loaded) return <Loading what="your exam" />;
  return exam ? <ExamSession exam={exam} onChange={update} /> : <ExamSetup onStart={update} />;
}

// ---------- Setup ----------

function ExamSetup({ onStart }: { onStart: (e: ActiveExam) => void }) {
  const { data, now } = useProgress();
  const [cfg, setCfg] = useState<ExamConfig>(() => ({ units: [], difficulties: [], count: 10, minutes: 20, includeWritten: false, seed: randomSeed() }));
  const [countText, setCountText] = useState("10");
  const [minutesText, setMinutesText] = useState("20");
  const [failed, setFailed] = useState(false);
  const all = cat.catalog.questions;
  const byUnit = (u: string) => all.filter((q) => q.unit === u).length;
  const core = cat.units.filter((u) => u.kind === "core" && byUnit(u.id)).map((u) => u.id);
  const sup = cat.units.filter((u) => u.kind === "supplementary" && byUnit(u.id)).map((u) => u.id);
  const available = examQuestions(all, cfg, data, unitOrder(), Number.MAX_SAFE_INTEGER).length;
  const count = Math.min(cfg.count, available);
  const toggle = (list: (string | number)[], x: string | number) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  const start = () => {
    const qids = examQuestions(all, { ...cfg, count }, data, unitOrder());
    const title = `Mock exam: ${cfg.units.length ? cfg.units.map(shortUnit).join(", ") : "all 2015-draft chapters"}`;
    const begin = (idx: Indexes) => onStart(startExam(`e-${now()}-${cfg.seed}`, title, { ...cfg, count }, qids, (id) => idx.question(id)!, now()));
    const units = [...new Set(qids.map((id) => cat.question(id)!.unit))];
    const ready = peekIndexes(units);
    if (ready) return begin(ready);
    fetchIndexes(units).then(begin, () => setFailed(true));
  };
  return (
    <>
      <PageTitle title="Mock exams">Mock exams</PageTitle>
      <p className="lede">A timed exam drawn from the question bank. Answers are hidden until you submit. The clock keeps running if you leave the page or reload it.</p>
      {data.exams.length > 0 && (
        <p>
          <Link to="/exam/history">Your past exams ({data.exams.length})</Link>
        </p>
      )}
      <section className="card setup">
        <h2>Set up an exam</h2>
        <fieldset className="checks">
          <legend>2015-draft chapters (none ticked = all)</legend>
          {core.map((u) => (
            <label key={u} className="check">
              <input type="checkbox" checked={cfg.units.includes(u)} onChange={() => setCfg((c) => ({ ...c, units: toggle(c.units, u) as string[] }))} /> {unitName(u)} ({byUnit(u)})
            </label>
          ))}
        </fieldset>
        {sup.length > 0 && (
          <fieldset className="checks">
            <legend>Supplementary modules (not in the 2015 draft)</legend>
            {sup.map((u) => (
              <label key={u} className="check">
                <input type="checkbox" checked={cfg.units.includes(u)} onChange={() => setCfg((c) => ({ ...c, units: toggle(c.units, u) as string[] }))} /> {unitName(u)} ({byUnit(u)}) <Badge tone="sup">Supplementary</Badge>
              </label>
            ))}
          </fieldset>
        )}
        <fieldset className="checks">
          <legend>Difficulty (none ticked = all)</legend>
          {[1, 2, 3, 4].map((d) => (
            <label key={d} className="check">
              <input type="checkbox" checked={cfg.difficulties.includes(d)} onChange={() => setCfg((c) => ({ ...c, difficulties: toggle(c.difficulties, d) as number[] }))} /> {DIFFICULTY_LABEL[d as 1]}
            </label>
          ))}
        </fieldset>
        <label className="check">
          <input type="checkbox" checked={cfg.includeWritten} onChange={(e) => setCfg((c) => ({ ...c, includeWritten: e.target.checked }))} /> Include written answers (derivations, short answers).
          You mark these yourself after submitting.
        </label>
        <div className="row-inputs">
          <label>
            Number of questions{" "}
            <input
              type="number"
              min={1}
              max={Math.max(1, available)}
              value={countText}
              onChange={(e) => {
                setCountText(e.target.value);
                const n = Math.floor(Number(e.target.value));
                if (n >= 1) setCfg((c) => ({ ...c, count: n }));
              }}
            />
          </label>
          <label>
            Duration (minutes){" "}
            <input
              type="number"
              min={MIN_MINUTES}
              max={MAX_MINUTES}
              value={minutesText}
              onChange={(e) => {
                setMinutesText(e.target.value);
                const n = Math.floor(Number(e.target.value));
                if (n >= MIN_MINUTES && n <= MAX_MINUTES) setCfg((c) => ({ ...c, minutes: n }));
              }}
            />
          </label>
        </div>
        <p role="status" className="match-count">
          {available} question{available === 1 ? "" : "s"} available
          {available ? `; the exam will have ${count}, ${cfg.minutes} minute${cfg.minutes === 1 ? "" : "s"}.` : ". Choose other chapters or difficulties."}
        </p>
        <button type="button" className="btn btn-primary" disabled={!available} onClick={start}>
          Start exam
        </button>
        {failed && (
          <p className="flag" role="alert">
            The questions could not be loaded. If you are offline, open their chapters once while online, or use Settings → Save for offline.
          </p>
        )}
      </section>
    </>
  );
}

// ---------- The exam ----------

function ExamSession({ exam, onChange }: { exam: ActiveExam; onChange: (e: ActiveExam | null) => void }) {
  const units = useMemo(() => [...new Set(exam.qids.map((id) => cat.question(id)!.unit))], [exam.qids]);
  const idx = useContent(units);
  return <ExamRunner exam={exam} q={(id) => idx.question(id)!} onChange={onChange} />;
}

function ExamRunner({ exam: e, q, onChange }: { exam: ActiveExam; q: (id: string) => Question; onChange: (e: ActiveExam | null) => void }) {
  const { now, saveExam } = useProgress();
  const navigate = useNavigate();
  const [, tick] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const submitted = useRef(false);
  const latest = useRef(e);
  latest.current = e;

  const submit = (by: "submitted" | "timeout") => {
    if (submitted.current) return;
    submitted.current = true;
    const { record, attempts } = submitExam(latest.current, q, now(), by);
    saveExam(record, attempts);
    onChange(null);
    navigate(`/exam/result/${record.id}`, { replace: true });
  };

  // Resume: time away from this page is not credited to the question; an exam already past its deadline is submitted at once.
  useEffect(() => {
    if (isExpired(latest.current, now())) submit("timeout");
    else onChange(resumeExam(latest.current, now()));
    // Runs once on mount: the latest exam is read through a ref.
  }, []);
  // The clock: re-render every second; submit automatically when time is up.
  useEffect(() => {
    const id = setInterval(() => {
      if (isExpired(latest.current, now())) submit("timeout");
      else tick((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);
  // A reload or closing the tab asks first. The exam is saved either way and resumes on return.
  useEffect(() => {
    const warn = (ev: BeforeUnloadEvent) => {
      ev.preventDefault();
      ev.returnValue = "";
    };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, []);

  const left = remainingMs(e, now());
  const qid = e.qids[e.current];
  const question = q(qid);
  const counts = examCounts(e, q);
  const inReview = e.review.includes(qid);
  const warning = left <= 60_000 ? "Less than 1 minute left." : left <= 5 * 60_000 ? "Less than 5 minutes left." : "";

  return (
    <>
      <PageTitle title={e.title}>{e.title}</PageTitle>
      <div className={`exam-bar ${left <= 5 * 60_000 ? "low" : ""}`}>
        <span role="timer" aria-label="Time left">
          {formatClock(left)}
        </span>
        <span className="muted small">
          {counts.answered} answered · {counts.unanswered} unanswered · {counts.review} marked for review
        </span>
      </div>
      <p className="sr-only" aria-live="assertive">
        {warning}
      </p>
      <nav className="palette" aria-label="Exam questions">
        {e.qids.map((id, i) => {
          const st = questionState(e, q(id));
          const rv = e.review.includes(id);
          const label = `Question ${i + 1}: ${st === "not-visited" ? "not visited" : st}${rv ? ", marked for review" : ""}`;
          return (
            <button key={id} type="button" className={`pal pal-${st} ${rv ? "pal-review" : ""} ${i === e.current ? "current" : ""}`} aria-label={label} aria-current={i === e.current ? "step" : undefined} onClick={() => onChange(goTo(e, i, now()))}>
              {i + 1}
              {rv ? "⚑" : ""}
            </button>
          );
        })}
      </nav>
      <p className="muted small palette-legend">Filled: answered · outlined: seen but unanswered · plain: not visited · ⚑: marked for review</p>

      <article className="item question" aria-labelledby="eq-h">
        <QuestionHeader q={question} id="eq-h" label={`Question ${e.current + 1} of ${e.qids.length}`} />
        <Md text={question.stem} />
        <AnswerInput q={question} draft={e.drafts[qid]} onChange={(d: Draft) => onChange(setAnswer(e, qid, d, now()))} locked={left <= 0} showKey={false} grade={null} name={`eq-${qid}`} />
        <div className="actions">
          <button type="button" className="btn" aria-pressed={inReview} onClick={() => onChange(toggleReview(e, qid))}>
            {inReview ? "⚑ Marked for review" : "Mark for review"}
          </button>
        </div>
      </article>

      <nav className="pager" aria-label="Previous and next question">
        <button type="button" className="btn" disabled={e.current === 0} onClick={() => onChange(goTo(e, e.current - 1, now()))}>
          ← Previous
        </button>
        {e.current < e.qids.length - 1 ? (
          <button type="button" className="btn" onClick={() => onChange(goTo(e, e.current + 1, now()))}>
            Next →
          </button>
        ) : (
          <span />
        )}
      </nav>

      {!confirming ? (
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={() => setConfirming(true)}>
            Submit exam
          </button>
        </div>
      ) : (
        <section className="card confirm" role="alertdialog" aria-labelledby="confirm-h" aria-describedby="confirm-d">
          <h2 id="confirm-h">Submit the exam?</h2>
          <p id="confirm-d">
            {counts.answered} of {e.qids.length} answered{counts.unanswered ? `, ${counts.unanswered} unanswered (they score 0)` : ""}
            {counts.review ? `, ${counts.review} marked for review` : ""}. You cannot change answers after submitting.
          </p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => submit("submitted")}>
              Submit now
            </button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>
              Keep working
            </button>
          </div>
        </section>
      )}
    </>
  );
}

// ---------- Results ----------

function BreakdownTable({ caption, rows, label }: { caption: string; rows: Breakdown[]; label: (k: string) => string }) {
  return (
    <table className="breakdown">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{caption.replace(/^By /, "").replace(/^\w/, (c) => c.toUpperCase())}</th>
          <th scope="col">Questions</th>
          <th scope="col">Fully correct</th>
          <th scope="col">Marks</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <th scope="row">{label(r.key)}</th>
            <td>{r.questions}</td>
            <td>{r.correct}</td>
            <td>
              {r.score} / {r.max} ({pct(r.max ? r.score / r.max : 0)})
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ExamResultPage() {
  const { id = "" } = useParams();
  const { data } = useProgress();
  const record = data.exams.find((x) => x.id === id);
  if (!record) return <NotFound />;
  return <ExamResultBody record={record} />;
}

function ExamResultBody({ record: r }: { record: ExamRecord }) {
  const idx = useContent([...new Set(r.items.map((x) => x.unit))]);
  const { saveExam, now } = useProgress();
  const res = examResults(r);
  const [marks, setMarks] = useState<Record<string, Draft>>({});
  const q = (id: string) => idx.question(id);
  const item = (qid: string) => r.items.find((x) => x.qid === qid)!;
  const review = (qid: string, i: number) => {
    const question = q(qid);
    const it = item(qid);
    if (!question) return <li key={qid}>{qid} (no longer in the question bank)</li>;
    const draft = (marks[qid] ?? it.draft) as Draft | undefined;
    const grade = it.answered && !it.awaitingMark ? { score: it.score, max: it.max, correct: it.score >= it.max } : null;
    return (
      <li key={qid} className="item">
        <details open={it.awaitingMark}>
          <summary>
            <strong>Question {r.items.indexOf(it) + 1}</strong> · {TYPE_LABEL[question.type]} · {shortUnit(it.unit)}
            {it.section ? ` §${it.section}` : ""} · {it.answered ? (it.awaitingMark ? "waiting for your mark" : `${it.score} / ${it.max}`) : "unanswered"}
            {it.markedForReview ? " · ⚑" : ""}
          </summary>
          <QuestionHeader q={question} label={`Question ${r.items.indexOf(it) + 1}`} />
          <Md text={question.stem} />
          {draft && <AnswerInput q={question} draft={draft} onChange={() => undefined} locked showKey={!isSelfMarked(question)} grade={grade && !isSelfMarked(question) ? gradeParts(question, draft) : null} name={`xr-${qid}-${i}`} />}
          {it.awaitingMark && draft && (
            <>
              <RubricMarker q={question} draft={draft} onChange={(d) => setMarks((m) => ({ ...m, [qid]: d }))} />
              <button
                type="button"
                className="btn btn-primary"
                disabled={!question.rubric?.length && draft.selfScore === null}
                onClick={() => {
                  const out = markExamItem(r, question, draft, now());
                  saveExam(out.record, out.attempt ? [out.attempt] : []);
                }}
              >
                Record my mark
              </button>
            </>
          )}
          {grade && <Verdict grade={grade} selfMarked={it.selfMarked} />}
          <Solution q={question} />
        </details>
      </li>
    );
  };
  return (
    <>
      <p className="crumb">
        <Link to="/exam">Mock exams</Link> / <Link to="/exam/history">history</Link> / result
      </p>
      <PageTitle title="Exam results">{r.title}: results</PageTitle>
      <p className="muted">
        Taken {new Date(r.startedAt).toLocaleString()} · {r.endedBy === "timeout" ? "submitted automatically when time ran out" : "submitted by you"}
      </p>
      <div className="stats">
        <Stat label="Total score" value={`${res.score} / ${res.max}`} hint={pct(res.percent)} />
        <Stat label="Accuracy" value={res.accuracy === null ? "–" : pct(res.accuracy)} hint="of marks on answered questions" />
        <Stat label="Fully correct" value={`${res.correct} of ${r.items.length}`} />
        <Stat label="Unattempted" value={res.unattempted.length} />
        <Stat label="Time taken" value={formatClock(res.elapsedMs)} hint={`of ${formatClock(res.limitMs)}`} />
      </div>
      {res.awaitingMark.length > 0 && (
        <p className="flag" role="status">
          {res.awaitingMark.length} written answer{res.awaitingMark.length === 1 ? " is" : "s are"} waiting for your mark below. Until then they count 0.
        </p>
      )}
      <BreakdownTable caption="By chapter" rows={res.byUnit} label={(u) => unitName(u) + (isSupplementaryUnit(u) ? " (supplementary)" : "")} />
      <BreakdownTable caption="By difficulty" rows={res.byDifficulty} label={(d) => DIFFICULTY_LABEL[Number(d) as 1]} />
      <BreakdownTable caption="By topic" rows={res.byConcept} label={(c) => cat.concept(c)?.title ?? c} />
      <p className="muted small">A question about several topics counts once under each of them.</p>

      {res.awaitingMark.length > 0 && (
        <section>
          <h2>Waiting for your mark</h2>
          <ol className="review-list">{res.awaitingMark.map(review)}</ol>
        </section>
      )}
      <section>
        <h2>Answered incorrectly or partly ({res.incorrect.length})</h2>
        {res.incorrect.length ? <ol className="review-list">{res.incorrect.map(review)}</ol> : <Empty>None.</Empty>}
      </section>
      <section>
        <h2>Unattempted ({res.unattempted.length})</h2>
        {res.unattempted.length ? <ol className="review-list">{res.unattempted.map(review)}</ol> : <Empty>None.</Empty>}
      </section>
      <section>
        <h2>All questions with solutions</h2>
        <ol className="review-list">{r.items.map((x, i) => review(x.qid, i + 1000))}</ol>
      </section>
      <div className="actions">
        <Link className="btn btn-primary" to="/exam">
          New exam
        </Link>
        <Link className="btn" to="/practice">
          Practise
        </Link>
      </div>
    </>
  );
}

/** Per-part correctness for the review display, recomputed from the stored answer with the same pure grader. */
const gradeParts = (question: Question, draft: Draft) => (isAnswered(question, draft) ? gradeDraft(question, draft) : null);

export function ExamHistoryPage() {
  const { data } = useProgress();
  const list = [...data.exams].sort((a, b) => b.startedAt - a.startedAt);
  return (
    <>
      <p className="crumb">
        <Link to="/exam">Mock exams</Link> / history
      </p>
      <PageTitle title="Exam history">Exam history</PageTitle>
      {list.length ? (
        <table className="breakdown">
          <caption className="sr-only">Past exams, newest first</caption>
          <thead>
            <tr>
              <th scope="col">Exam</th>
              <th scope="col">Date</th>
              <th scope="col">Score</th>
              <th scope="col">Time</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const res = examResults(r);
              return (
                <tr key={r.id}>
                  <th scope="row">
                    <Link to={`/exam/result/${r.id}`}>{r.title}</Link>
                    {res.awaitingMark.length ? <Badge tone="warn">to mark</Badge> : null}
                  </th>
                  <td>{new Date(r.startedAt).toLocaleDateString()}</td>
                  <td>
                    {res.score} / {res.max} ({pct(res.percent)})
                  </td>
                  <td>
                    {formatClock(r.elapsedMs)}
                    {r.endedBy === "timeout" ? " (time out)" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <Empty>
          No exams yet. <Link to="/exam">Take one</Link>.
        </Empty>
      )}
    </>
  );
}
