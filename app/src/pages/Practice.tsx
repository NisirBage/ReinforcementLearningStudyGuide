// Practice: choose questions by chapter, section, topic, difficulty, type and source; answer them with immediate
// or end-of-session feedback; see step-by-step solutions; bookmark, flag and re-attempt. All selection, grading and
// timing lives in domain/practice.ts and domain/session.ts; this file wires them to the screen and to storage.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cat, fetchIndexes, peekIndexes, useContent } from "../content/load";
import type { Indexes } from "../content/indexes";
import { DIFFICULTY_LABEL, PROVENANCE_KINDS, PROVENANCE_LABEL, QUESTION_TYPES, isSupplementaryUnit, type Question } from "../content/schema";
import { isAnswered, isSelfMarked } from "../domain/answer";
import {
  ORDERS, ORDER_LABEL, POOLS, POOL_LABEL, compareSections, defaultConfig, matchingQuestions, selectQuestions, type PracticeConfig,
} from "../domain/practice";
import { incorrectQids, repeatedMistakes } from "../domain/progress";
import { makeRng, randomSeed, shuffle } from "../domain/random";
import { check, finish, goTo, isSession, markSelf, revealStep, setDraft, startSession, summarize, type PracticeSession } from "../domain/session";
import { useProgress } from "../store/ProgressContext";
import { Loading } from "../components/Boundary";
import { AnswerInput, QuestionHeader, RubricMarker, Solution, TYPE_LABEL, Verdict } from "../components/question";
import { Md } from "../components/math";
import { Badge, Empty, PageTitle, Stat, pct } from "../components/ui";

const SLOT = "practice";
const unitOrder = () => cat.units.map((u) => u.id);
const unitName = (u: string) => (cat.unit(u)?.kind === "core" ? `Chapter ${cat.unit(u)!.core!.chapter}: ${cat.unit(u)!.title}` : cat.unit(u)?.title ?? u);
const sectionTitle = (unit: string, id: string) => cat.sectionsOf(unit).find((s) => s.section.id === id)?.section.title ?? "";
export const formatMs = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
};

export function PracticePage() {
  const { slot, ready } = useProgress();
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<PracticeSession | null>(null);
  useEffect(() => {
    let live = true;
    slot.load(SLOT).then((v) => {
      if (!live) return;
      // Only a session whose questions still exist is resumed; anything else is dropped.
      if (isSession(v) && v.qids.every((id) => cat.question(id))) setSession({ ...v, enteredAt: Date.now() });
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [slot]);
  const update = (s: PracticeSession | null) => {
    setSession(s);
    if (s) slot.save(SLOT, s);
    else slot.clear(SLOT);
  };
  if (!ready || !loaded) return <Loading what="your practice session" />;
  if (!session) return <Setup onStart={update} />;
  return <SessionView session={session} onChange={update} />;
}

// ---------- Setup ----------

function Checks<T extends string | number>({ legend, options, value, onChange, label }: { legend: string; options: T[]; value: T[]; onChange: (v: T[]) => void; label: (x: T) => ReactNode }) {
  return (
    <fieldset className="checks">
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={String(o)} className="check">
          <input type="checkbox" checked={value.includes(o)} onChange={(e) => onChange(e.target.checked ? [...value, o] : value.filter((x) => x !== o))} /> {label(o)}
        </label>
      ))}
    </fieldset>
  );
}

function Setup({ onStart }: { onStart: (s: PracticeSession) => void }) {
  const { data } = useProgress();
  const [cfg, setCfg] = useState<PracticeConfig>(() => defaultConfig(randomSeed()));
  const set = (p: Partial<PracticeConfig>) => setCfg((c) => ({ ...c, ...p }));
  // The count box may be empty while the learner types; the session uses at least 1.
  const [countText, setCountText] = useState(String(cfg.count));
  useEffect(() => setCountText(String(cfg.count)), [cfg.count]);
  const all = cat.catalog.questions;
  const byUnit = (u: string) => all.filter((q) => q.unit === u).length;
  const coreUnits = cat.units.filter((u) => u.kind === "core" && byUnit(u.id) > 0).map((u) => u.id);
  const supUnits = cat.units.filter((u) => u.kind === "supplementary" && byUnit(u.id) > 0).map((u) => u.id);
  // Section and topic choices come from the questions in the chosen chapters.
  const inUnits = all.filter((q) => (cfg.units.length ? cfg.units.includes(q.unit) : !isSupplementaryUnit(q.unit)));
  const sections = [...new Map(inUnits.filter((q) => q.section).map((q) => [q.section!, q.unit])).entries()].sort((a, b) => compareSections(a[0], b[0]));
  const topics = [...new Set(inUnits.flatMap((q) => q.concepts))].sort((a, b) => (cat.concept(a)?.title ?? a).localeCompare(cat.concept(b)?.title ?? b));
  const types = QUESTION_TYPES.filter((t) => all.some((q) => q.type === t));
  const matching = matchingQuestions(all, cfg, data, unitOrder());
  const poolCount = (pool: PracticeConfig["pool"]) => matchingQuestions(all, { ...cfg, pool }, data, unitOrder()).length;
  const count = Math.min(cfg.count, matching.length);
  const [starting, setStarting] = useState<"idle" | "loading" | "failed">("idle");
  const start = () => {
    const qids = selectQuestions(all, { ...cfg, count }, data, unitOrder());
    const units = [...new Set(qids.map((id) => cat.question(id)!.unit))];
    const begin = (idx: Indexes) => onStart(startSession(`p-${Date.now()}-${cfg.seed}`, { ...cfg, count }, qids, (id) => idx.question(id)!, Date.now()));
    // The session needs the full questions (options, parts, rubrics): use them at once if loaded, else fetch them.
    const ready = peekIndexes(units);
    if (ready) return begin(ready);
    setStarting("loading");
    fetchIndexes(units).then(begin, () => setStarting("failed"));
  };

  return (
    <>
      <PageTitle title="Practice">Practice</PageTitle>
      <p className="lede">
        Choose what to practise. Every question shows where it comes from: a reworded exercise of the April 2015 draft, a question derived from the draft, a new application
        question, or supplementary material.
      </p>
      <QuickStarts onPick={(p) => setCfg((c) => ({ ...c, ...p }))} />
      <section className="card setup">
        <h2>Chapters</h2>
        <p className="muted small">None ticked = every 2015-draft chapter. Supplementary modules are included only if you tick them.</p>
        <Checks legend="2015-draft chapters" options={coreUnits} value={cfg.units} onChange={(units) => set({ units, sections: [], concepts: [] })} label={(u) => `${unitName(u)} (${byUnit(u)})`} />
        {supUnits.length > 0 && (
          <Checks
            legend="Supplementary modules (not in the 2015 draft)"
            options={supUnits}
            value={cfg.units}
            onChange={(units) => set({ units, sections: [], concepts: [] })}
            label={(u) => (
              <>
                {unitName(u)} ({byUnit(u)}) <Badge tone="sup">Supplementary</Badge>
              </>
            )}
          />
        )}
        <Checks legend="Difficulty" options={[1, 2, 3, 4]} value={cfg.difficulties} onChange={(difficulties) => set({ difficulties })} label={(d) => DIFFICULTY_LABEL[d as 1]} />
        <details>
          <summary>Sections, topics, question types and sources</summary>
          <Checks legend="Sections" options={sections.map(([s]) => s)} value={cfg.sections} onChange={(s) => set({ sections: s })} label={(s) => `§${s} ${sectionTitle(sections.find(([x]) => x === s)![1], s)}`} />
          <Checks legend="Topics" options={topics} value={cfg.concepts} onChange={(concepts) => set({ concepts })} label={(c) => cat.concept(c)?.title ?? c} />
          <Checks legend="Question types" options={[...types]} value={cfg.types} onChange={(t) => set({ types: t })} label={(t) => TYPE_LABEL[t]} />
          <Checks legend="Where questions come from" options={[...PROVENANCE_KINDS]} value={cfg.provenance} onChange={(provenance) => set({ provenance })} label={(k) => PROVENANCE_LABEL[k]} />
        </details>
      </section>
      <section className="card setup">
        <h2>Which questions</h2>
        <fieldset className="checks">
          <legend>Draw from</legend>
          {POOLS.map((p) => (
            <label key={p} className="check">
              <input type="radio" name="pool" checked={cfg.pool === p} onChange={() => set({ pool: p })} /> {POOL_LABEL[p]} ({poolCount(p)})
            </label>
          ))}
        </fieldset>
        <fieldset className="checks">
          <legend>Order</legend>
          {ORDERS.map((o) => (
            <label key={o} className="check">
              <input type="radio" name="order" checked={cfg.order === o} onChange={() => set({ order: o })} /> {ORDER_LABEL[o]}
            </label>
          ))}
        </fieldset>
        <fieldset className="checks">
          <legend>Feedback</legend>
          <label className="check">
            <input type="radio" name="feedback" checked={cfg.feedback === "immediate"} onChange={() => set({ feedback: "immediate" })} /> After each question (check answers as you go)
          </label>
          <label className="check">
            <input type="radio" name="feedback" checked={cfg.feedback === "deferred"} onChange={() => set({ feedback: "deferred" })} /> At the end (no answers shown until you finish)
          </label>
        </fieldset>
        <div className="row-inputs">
          <label>
            Number of questions{" "}
            <input
              type="number"
              min={1}
              max={Math.max(1, matching.length)}
              value={countText}
              onChange={(e) => {
                setCountText(e.target.value);
                const n = Math.floor(Number(e.target.value));
                if (n >= 1) setCfg((c) => ({ ...c, count: n }));
              }}
            />
          </label>
          {cfg.order !== "book" && (
            <label>
              Seed{" "}
              <input type="number" value={cfg.seed} onChange={(e) => set({ seed: Number(e.target.value) || 0 })} aria-describedby="seed-help" />{" "}
              <button type="button" className="btn btn-small" onClick={() => set({ seed: randomSeed() })}>
                New seed
              </button>
            </label>
          )}
        </div>
        {cfg.order !== "book" && (
          <p id="seed-help" className="muted small">
            The same seed with the same choices gives the same questions in the same order.
          </p>
        )}
        <p role="status" className="match-count">
          {matching.length} question{matching.length === 1 ? "" : "s"} match{matching.length === 1 ? "es" : ""}
          {matching.length ? `; the session will have ${count}.` : ". Loosen a filter or choose another pool."}
        </p>
        <button type="button" className="btn btn-primary" disabled={matching.length === 0 || starting === "loading"} onClick={start}>
          {starting === "loading" ? "Loading questions…" : "Start practice"}
        </button>
        {starting === "failed" && (
          <p className="flag" role="alert">
            The questions could not be loaded. If you are offline, open their chapters once while online, or use Settings → Save for offline.
          </p>
        )}
      </section>
    </>
  );
}

/** One-click sessions from the learner's own history. Counts are real and the buttons are disabled when empty. */
function QuickStarts({ onPick }: { onPick: (p: Partial<PracticeConfig>) => void }) {
  const { data } = useProgress();
  const wrong = incorrectQids(data.attempts).length;
  const repeated = repeatedMistakes(data.attempts).length;
  const quick: [string, Partial<PracticeConfig>, number][] = [
    ["Re-attempt questions I got wrong", { pool: "incorrect", units: [], order: "random" }, wrong],
    ["My repeated mistakes", { pool: "repeated", units: [], order: "random" }, repeated],
    ["Bookmarked questions", { pool: "bookmarked", units: [], order: "book" }, data.bookmarks.length],
    ["Flagged for revision", { pool: "flagged", units: [], order: "book" }, data.marked.length],
  ];
  return (
    <div className="tiles">
      {quick.map(([label, p, n]) => (
        <button key={label} type="button" className="tile" disabled={n === 0} onClick={() => onPick({ ...p, count: Math.max(n, 1), sections: [], concepts: [], difficulties: [], types: [], provenance: [] })}>
          <strong>{label}</strong>
          <span>{n ? `${n} question${n === 1 ? "" : "s"}` : "none yet"}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- Running a session ----------

function SessionView({ session, onChange }: { session: PracticeSession; onChange: (s: PracticeSession | null) => void }) {
  const units = useMemo(() => [...new Set(session.qids.map((id) => cat.question(id)!.unit))], [session.qids]);
  const idx = useContent(units);
  const q = (id: string) => idx.question(id)!;
  if (session.finishedAt !== null) return <Results session={session} q={q} onChange={onChange} />;
  return <Runner session={session} q={q} onChange={onChange} />;
}

function itemStatus(s: PracticeSession, q: Question): string {
  const it = s.items[q.id];
  if (it.phase === "graded") return it.grade!.correct ? "correct" : it.grade!.score > 0 ? "partly correct" : "not correct";
  if (it.phase === "revealed") return "waiting for your mark";
  return isAnswered(q, it.draft) ? "answered" : "not answered";
}

function Runner({ session: s, q, onChange }: { session: PracticeSession; q: (id: string) => Question; onChange: (s: PracticeSession | null) => void }) {
  const { data, toggleMark, toggleBookmark, recordAttempts } = useProgress();
  const qid = s.qids[s.current];
  const question = q(qid);
  const it = s.items[qid];
  const immediate = s.config.feedback === "immediate";
  const self = isSelfMarked(question);
  const now = () => Date.now();
  const doCheck = () => {
    const r = check(s, question, now());
    if (r.attempt) recordAttempts([r.attempt]);
    onChange(r.session);
  };
  const doMark = () => {
    const r = markSelf(s, question, it.draft, now());
    if (r.attempt) recordAttempts([r.attempt]);
    onChange(r.session);
  };
  const doFinish = () => {
    const open = s.qids.filter((id) => s.items[id].phase === "answering" && !isAnswered(q(id), s.items[id].draft)).length;
    if (open && !window.confirm(`${open} question${open === 1 ? " is" : "s are"} not answered. Finish anyway? Unanswered questions are not counted as attempts.`)) return;
    const r = finish(s, q, now());
    if (r.attempts.length) recordAttempts(r.attempts);
    onChange(r.session);
  };
  const flagged = data.marked.includes(qid);
  const bookmarked = data.bookmarks.includes(qid);
  const showKey = it.phase === "graded" && !self;

  return (
    <>
      <PageTitle title="Practice">Practice</PageTitle>
      <p className="muted">
        {immediate ? "Feedback after each question" : "Feedback at the end"} · {s.qids.length} question{s.qids.length === 1 ? "" : "s"}
        {s.config.order !== "book" ? ` · seed ${s.config.seed}` : ""}
      </p>
      <nav className="palette" aria-label="Questions in this session">
        {s.qids.map((id, i) => {
          const st = itemStatus(s, q(id));
          return (
            <button
              key={id}
              type="button"
              className={`pal ${i === s.current ? "current" : ""} pal-${st.replace(/ /g, "-")}`}
              aria-current={i === s.current ? "step" : undefined}
              aria-label={`Question ${i + 1}: ${st}`}
              onClick={() => onChange(goTo(s, i, now()))}
            >
              {i + 1}
            </button>
          );
        })}
      </nav>

      <article className="item question" aria-labelledby="pq-h">
        <QuestionHeader
          q={question}
          id="pq-h"
          label={`Question ${s.current + 1} of ${s.qids.length}`}
          extra={<span className="muted small">{unitName(question.unit)}{question.section ? ` · §${question.section}` : ""}</span>}
        />
        <Md text={question.stem} />
        <AnswerInput q={question} draft={it.draft} onChange={(d) => onChange(setDraft(s, qid, d))} locked={it.phase !== "answering"} showKey={showKey} grade={it.grade} name={`pq-${qid}`} />
        {it.phase === "revealed" && <RubricMarker q={question} draft={it.draft} onChange={(d) => onChange({ ...s, items: { ...s.items, [qid]: { ...it, draft: d } } })} />}
        <div className="actions">
          {immediate && it.phase === "answering" && !self && (
            <button type="button" className="btn btn-primary" onClick={doCheck} disabled={!isAnswered(question, it.draft)}>
              Check answer
            </button>
          )}
          {immediate && it.phase === "answering" && self && (
            <button type="button" className="btn btn-primary" onClick={doCheck}>
              Show model answer
            </button>
          )}
          {it.phase === "revealed" && (
            <button type="button" className="btn btn-primary" onClick={doMark} disabled={!question.rubric?.length && it.draft.selfScore === null}>
              Record my mark
            </button>
          )}
          <button type="button" className="btn" aria-pressed={bookmarked} onClick={() => toggleBookmark(qid)}>
            {bookmarked ? "Bookmarked" : "Bookmark"}
          </button>
          <button type="button" className="btn" aria-pressed={flagged} onClick={() => toggleMark(qid)}>
            {flagged ? "★ Flagged for revision" : "☆ Flag for revision"}
          </button>
        </div>
        {(it.phase === "graded" || it.phase === "revealed") && (
          <div className="feedback" role="status">
            {it.grade && <Verdict grade={it.grade} selfMarked={self} />}
            <Solution
              q={question}
              stepwise={it.phase === "graded" && !self}
              steps={it.steps}
              onStep={() => onChange(revealStep(s, qid, question))}
              onAll={() => onChange(revealStep(s, qid, question, true))}
            />
          </div>
        )}
      </article>

      <nav className="pager" aria-label="Previous and next question">
        <button type="button" className="btn" disabled={s.current === 0} onClick={() => onChange(goTo(s, s.current - 1, now()))}>
          ← Previous
        </button>
        {s.current < s.qids.length - 1 ? (
          <button type="button" className="btn" onClick={() => onChange(goTo(s, s.current + 1, now()))}>
            Next →
          </button>
        ) : (
          <span />
        )}
      </nav>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={doFinish}>
          Finish and see results
        </button>
      </div>
    </>
  );
}

// ---------- Results ----------

function Results({ session: s, q, onChange }: { session: PracticeSession; q: (id: string) => Question; onChange: (s: PracticeSession | null) => void }) {
  const { recordAttempts } = useProgress();
  const sum = summarize(s, q);
  const again = (qids: string[], seed: number) => onChange(startSession(`p-${Date.now()}-${seed}`, { ...s.config, seed, count: qids.length }, qids, q, Date.now()));
  return (
    <>
      <PageTitle title="Practice results">Practice results</PageTitle>
      <div className="stats">
        <Stat label="Score" value={`${sum.score} / ${sum.max}`} hint={sum.awaitingMark ? `${sum.awaitingMark} still to mark` : undefined} />
        <Stat label="Accuracy" value={sum.accuracy === null ? "–" : pct(sum.accuracy)} hint="of marks on answered questions" />
        <Stat label="Correct" value={`${sum.correct} of ${sum.questions}`} hint={`${sum.partial} partly, ${sum.incorrect} not correct`} />
        <Stat label="Unanswered" value={sum.unanswered} hint="not counted as attempts" />
        <Stat label="Time" value={formatMs(sum.ms)} />
      </div>
      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={!sum.wrongQids.length} onClick={() => again(sum.wrongQids, s.config.seed)}>
          Re-attempt the {sum.wrongQids.length} not fully correct
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const seed = randomSeed();
            again(shuffle(s.qids, makeRng(seed)), seed);
          }}
        >
          Same questions, new order
        </button>
        <button type="button" className="btn" onClick={() => onChange(null)}>
          New practice
        </button>
      </div>
      <h2>Question by question</h2>
      <ol className="review-list">
        {s.qids.map((id, i) => {
          const question = q(id);
          const it = s.items[id];
          const st = itemStatus(s, question);
          return (
            <li key={id} className="item">
              <details open={it.phase === "revealed"}>
                <summary>
                  <strong>Question {i + 1}</strong> · {TYPE_LABEL[question.type]} · {unitName(question.unit)}
                  {question.section ? ` §${question.section}` : ""} · <span className={`st st-${st.replace(/ /g, "-")}`}>{st}</span>
                  {it.grade ? ` · ${it.grade.score} / ${it.grade.max}` : ""} · {formatMs(it.ms)}
                </summary>
                <QuestionHeader q={question} label={`Question ${i + 1}`} />
                <Md text={question.stem} />
                <AnswerInput q={question} draft={it.draft} onChange={() => undefined} locked showKey={!isSelfMarked(question)} grade={it.grade} name={`rq-${id}`} />
                {it.phase === "revealed" && (
                  <>
                    <RubricMarker q={question} draft={it.draft} onChange={(d) => onChange({ ...s, items: { ...s.items, [id]: { ...it, draft: d } } })} />
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!question.rubric?.length && it.draft.selfScore === null}
                      onClick={() => {
                        const r = markSelf(s, question, it.draft, Date.now());
                        if (r.attempt) recordAttempts([r.attempt]);
                        onChange(r.session);
                      }}
                    >
                      Record my mark
                    </button>
                  </>
                )}
                {it.grade && <Verdict grade={it.grade} selfMarked={isSelfMarked(question)} />}
                <Solution q={question} />
              </details>
            </li>
          );
        })}
      </ol>
      {!s.qids.length && <Empty>No questions in this session.</Empty>}
      <p className="muted small">
        Attempts are saved to your progress. <Link to="/progress">See progress</Link>
      </p>
    </>
  );
}
