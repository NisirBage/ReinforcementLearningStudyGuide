import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cat } from "../content/load";
import { CONCEPT_STATUSES, STATUS_LABEL, accuracyOf, completion, examSummary, labUse, questionSummary, repeatedMistakes, revisionBacklog, statusOf, topicMastery, weakest } from "../domain/progress";
import { exportProgress } from "../store/persistence";
import { requestPersistence } from "../store/idb";
import { offlineStatus, offlineSupported, saveAllOffline, type OfflineStatus } from "../store/offline";
import { useProgress } from "../store/ProgressContext";
import { Bar, ConfirmButton, Empty, PageTitle, Stat, pct } from "../components/ui";

/** "45 s", "12 min", "1 h 05 min". */
export function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

/** A question's name for lists: its chapter, number and section. */
function questionName(qid: string): string {
  const q = cat.question(qid);
  const u = q && cat.unit(q.unit);
  if (!q || !u) return qid;
  return `${u.kind === "core" ? `Chapter ${u.core!.chapter}` : u.title}, question ${Number(qid.split("-q")[1])}${q.section ? ` (§${q.section})` : ""}`;
}

export function ProgressPage() {
  const { data, importMerge, resetAll } = useProgress();
  const [msg, setMsg] = useState("");
  const [persist, setPersist] = useState("checking…");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    requestPersistence().then((s) =>
      setPersist(s === "persisted" ? "The browser has agreed not to clear this data automatically." : s === "unsupported" ? "This browser cannot promise to keep the data; export backups regularly." : "The browser may clear this data if storage runs low; export backups regularly."),
    );
  }, []);
  const acc = accuracyOf(data.attempts);
  const coreUnits = cat.units.filter((u) => u.kind === "core" && cat.conceptsOf(u.id).length);
  const supUnits = cat.units.filter((u) => u.kind === "supplementary" && cat.conceptsOf(u.id).length);
  const allConcepts = cat.catalog.concepts;
  const counts = CONCEPT_STATUSES.map((s) => [s, allConcepts.filter((c) => !c.unit.startsWith("sup-") && statusOf(data, c.id) === s).length] as const);
  const weakUnits = weakest(data.attempts, "unit", 3);
  const qs = questionSummary(data.attempts);
  const backlog = revisionBacklog(data, Date.now());
  const mistakes = repeatedMistakes(data.attempts);
  const exams = examSummary(data.exams);
  const labs = labUse(data);
  const conceptIds = [...allConcepts.filter((c) => !c.unit.startsWith("sup-")), ...allConcepts.filter((c) => c.unit.startsWith("sup-"))].map((c) => c.id);
  const mastery = topicMastery(data, conceptIds, cat.catalog.questions);

  const doExport = () => {
    const blob = new Blob([exportProgress(data)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rl-study-lab-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("Backup downloaded.");
  };

  return (
    <>
      <PageTitle title="Progress">Progress</PageTitle>
      <section className="stats" aria-label="Questions">
        <Stat label="Questions attempted" value={qs.attempted} hint={`${qs.attempts} attempts`} />
        <Stat label="Correct" value={qs.correct} hint="latest attempt, full marks" />
        <Stat label="Incorrect" value={qs.incorrect} hint="latest attempt below full marks" />
        <Stat label="Marks scored" value={acc.accuracy === null ? "–" : pct(acc.accuracy)} hint={acc.max ? `${acc.score} of ${acc.max}` : "no attempts yet"} />
        <Stat label="Time on questions" value={duration(qs.ms)} hint="measured in practice and exams" />
        <Stat label="Cards due now" value={backlog.dueCards.length} hint={`${Object.keys(data.cards).length} cards started`} />
      </section>

      <section className="card" aria-labelledby="backlog-h">
        <h2 id="backlog-h">Revision backlog</h2>
        {backlog.total ? (
          <ul className="list">
            <li>
              <Link to="/revision/review">{backlog.dueCards.length} revision cards due</Link>
            </li>
            <li>
              <Link to="/practice?pool=incorrect">{backlog.incorrect.length} questions to re-attempt</Link> <span className="muted">· latest attempt below full marks</span>
            </li>
            <li>
              <Link to="/revision/marked">{backlog.flagged.length} questions marked for revision</Link>
            </li>
            <li>
              {backlog.needsRevision.length} concepts set to “{STATUS_LABEL["needs-revision"]}”{backlog.needsRevision.length > 0 && ": "}
              {backlog.needsRevision.map((c, i) => (
                <span key={c}>
                  {i > 0 && ", "}
                  <Link to={`/concept/${c}`}>{cat.concept(c)?.title ?? c}</Link>
                </span>
              ))}
            </li>
          </ul>
        ) : (
          <Empty>Nothing waiting. Cards fall due as you review them, and questions you get wrong are added here.</Empty>
        )}
      </section>

      <section className="card" aria-labelledby="mistakes-h">
        <h2 id="mistakes-h">Repeated mistakes and bookmarks</h2>
        {mistakes.length ? (
          <>
            <p>
              Questions answered wrongly at least twice: <Link to="/practice?pool=repeated">practise them</Link>
            </p>
            <ul className="list">
              {mistakes.slice(0, 10).map((m) => (
                <li key={m.qid}>
                  {questionName(m.qid)} <span className="muted">· wrong {m.wrong} of {m.attempts} times</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">No question has been answered wrongly twice.</p>
        )}
        <p>
          {data.bookmarks.length ? (
            <>
              {data.bookmarks.length} bookmarked question{data.bookmarks.length === 1 ? "" : "s"}: <Link to="/practice?pool=bookmarked">practise them</Link>
            </>
          ) : (
            <span className="muted">No bookmarked questions. Use the bookmark button on any question.</span>
          )}
        </p>
      </section>

      <section className="card" aria-labelledby="exams-h">
        <h2 id="exams-h">Mock exams</h2>
        {exams.latest ? (
          <>
            <p>
              {exams.count} submitted · latest <Link to={`/exam/result/${exams.latest.id}`}>{exams.latest.title}</Link>: {pct(exams.latest.percent)} · best {pct(exams.best!)} · average{" "}
              {pct(exams.average!)}
            </p>
            <Link to="/exam/history">All mock exams</Link>
          </>
        ) : (
          <Empty>
            No mock exams yet. <Link to="/exam">Set one up</Link>.
          </Empty>
        )}
      </section>

      <section className="card">
        <h2>Core concepts by status</h2>
        <ul className="statuses">
          {counts.map(([s, n]) => (
            <li key={s}>
              <span className={`dot status-${s}`} aria-hidden="true" /> {STATUS_LABEL[s]}: <strong>{n}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>By chapter</h2>
        <table className="progress-table">
          <thead>
            <tr>
              <th scope="col">Chapter</th>
              <th scope="col">Understood or mastered</th>
              <th scope="col">Marks</th>
            </tr>
          </thead>
          <tbody>
            {[...coreUnits, ...supUnits].map((u) => {
              const ids = cat.conceptsOf(u.id).map((c) => c.id);
              const a = accuracyOf(data.attempts.filter((x) => x.unit === u.id));
              const done = completion(data, ids);
              return (
                <tr key={u.id}>
                  <td>
                    <Link to={`/learn/${u.id}`}>{u.kind === "core" ? `${u.core!.chapter}. ${u.title}` : `${u.title} (supplementary)`}</Link>
                  </td>
                  <td>
                    <Bar value={done} label={`${u.title}: concepts understood`} /> {pct(done)} of {ids.length}
                  </td>
                  <td>{a.accuracy === null ? "–" : `${pct(a.accuracy)} (${a.attempts})`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted small">Only chapters with learning material in the app are listed.</p>
      </section>

      <section className="card" aria-labelledby="mastery-h">
        <h2 id="mastery-h">Topic mastery</h2>
        <p className="muted small">
          Your own status for each concept beside the evidence from your answers: how many of its questions you have attempted, and the share of marks on your latest attempt at each.
        </p>
        <div className="table-wrap">
          <table className="progress-table">
            <thead>
              <tr>
                <th scope="col">Concept</th>
                <th scope="col">Your status</th>
                <th scope="col">Questions attempted</th>
                <th scope="col">Latest marks</th>
              </tr>
            </thead>
            <tbody>
              {mastery.map((m) => (
                <tr key={m.concept}>
                  <th scope="row">
                    <Link to={`/concept/${m.concept}`}>{cat.concept(m.concept)?.title ?? m.concept}</Link>
                  </th>
                  <td>{STATUS_LABEL[m.status]}</td>
                  <td>{m.available ? `${m.attempted} of ${m.available}` : "no questions yet"}</td>
                  <td>{m.latest === null ? "–" : pct(m.latest)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="labs-h">
        <h2 id="labs-h">Laboratories used</h2>
        {labs.length ? (
          <ul className="list">
            {labs.map((l) => (
              <li key={l.slug}>
                <Link to={`/lab/${l.slug}`}>{l.title}</Link>{" "}
                <span className="muted">
                  · opened {l.visits} time{l.visits === 1 ? "" : "s"}, last {new Date(l.last).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            No laboratory opened yet. <Link to="/lab">See the labs</Link>.
          </Empty>
        )}
        <p className="muted small">Counted from the activity log, which keeps your 200 most recent actions.</p>
      </section>

      <section className="card">
        <h2>Weakest chapters</h2>
        {weakUnits.length ? (
          <ul className="list">
            {weakUnits.map((w) => (
              <li key={w.key}>
                {cat.unit(w.key)?.title ?? w.key}: {pct(w.acc.accuracy ?? 0)} over {w.acc.attempts} attempts
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Needs at least three attempts in a chapter.</Empty>
        )}
      </section>

      <section className="card">
        <h2>Backup</h2>
        <p className="muted">
          Progress is stored only in this browser (IndexedDB). {persist}
        </p>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={doExport}>
            Export backup
          </button>
          <button type="button" className="btn" onClick={() => file.current?.click()}>
            Import and merge
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            data-testid="import"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                importMerge(await f.text());
                setMsg("Backup merged into this browser's progress.");
              } catch (err) {
                setMsg(`Import failed: ${(err as Error).message}`);
              }
            }}
          />
          <ConfirmButton label="Reset all progress" confirm="Erase all progress in this browser? Export a backup first if you might want it back." onConfirm={() => (resetAll(), setMsg("Progress reset."))} />
        </div>
        <p role="status">{msg}</p>
      </section>
    </>
  );
}

export function SettingsPage() {
  const { data, setSettings } = useProgress();
  return (
    <>
      <PageTitle title="Settings">Settings</PageTitle>
      <section className="card">
        <h2>Theme</h2>
        <div className="seg" role="radiogroup" aria-label="Theme">
          {(["system", "light", "dark"] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={data.settings.theme === t} className={data.settings.theme === t ? "on" : ""} onClick={() => setSettings({ theme: t })}>
              {t === "system" ? "Match device" : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>Notation</h2>
        <p>The app always shows the notation of the April 2015 draft.</p>
        <label className="check">
          <input type="checkbox" checked={data.settings.show2018Notation} onChange={(e) => setSettings({ show2018Notation: e.target.checked })} /> Also show cross-references to the
          published 2018 edition
        </label>
        <p className="muted small">These cross-references come from general knowledge of the 2018 edition. No copy of it was checked, so each one is marked unverified.</p>
      </section>
      <OfflineCard />
    </>
  );
}

function OfflineCard() {
  const [supported] = useState(offlineSupported);
  const [s, setS] = useState<OfflineStatus | null>(null);
  const [phase, setPhase] = useState<"idle" | "saving" | "done" | "error">("idle");
  useEffect(() => {
    if (supported) offlineStatus().then(setS, () => setPhase("error"));
  }, [supported]);
  const save = () => {
    setPhase("saving");
    saveAllOffline(setS).then(
      (r) => (setS(r), setPhase(r.failed ? "error" : "done")),
      () => setPhase("error"),
    );
  };
  return (
    <section className="card">
      <h2>Offline use</h2>
      <p>
        The app's pages are stored on this device when it is first opened. Each chapter's material is stored the first time you open it. To have every chapter, module
        and the search index available offline in advance, save everything now.
      </p>
      {!supported ? (
        <p className="muted small" role="status">
          Offline storage is managed by the installed build (served over HTTPS or from localhost). It is not active in this session, so pages are fetched as needed.
        </p>
      ) : (
        <>
          <p role="status" className="muted">
            {s ? `${s.stored} of ${s.total} files stored on this device${s.stored === s.total ? ": everything is available offline." : "."}` : "Checking…"}
            {phase === "error" && " Some files could not be stored; check the connection and try again."}
          </p>
          <button type="button" className="btn btn-primary" onClick={save} disabled={phase === "saving" || (s !== null && s.stored === s.total)}>
            {phase === "saving" ? "Saving…" : "Save everything for offline"}
          </button>
        </>
      )}
    </section>
  );
}
