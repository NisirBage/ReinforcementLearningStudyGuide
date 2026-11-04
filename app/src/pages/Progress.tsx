import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { idx } from "../content/bundle";
import { CONCEPT_STATUSES, STATUS_LABEL, accuracyOf, completion, dueCards, statusOf, weakest } from "../domain/progress";
import { exportProgress } from "../store/persistence";
import { requestPersistence } from "../store/idb";
import { useProgress } from "../store/ProgressContext";
import { Bar, ConfirmButton, Empty, PageTitle, Stat, pct } from "../components/ui";

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
  const coreUnits = idx.units.filter((u) => u.kind === "core" && idx.conceptsOf(u.id).length);
  const supUnits = idx.units.filter((u) => u.kind === "supplementary" && idx.conceptsOf(u.id).length);
  const allConcepts = idx.bundle.concepts;
  const counts = CONCEPT_STATUSES.map((s) => [s, allConcepts.filter((c) => !c.unit.startsWith("sup-") && statusOf(data, c.id) === s).length] as const);
  const weakUnits = weakest(data.attempts, "unit", 3);

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
      <section className="stats">
        <Stat label="Questions attempted" value={acc.attempted} hint={`${acc.attempts} attempts`} />
        <Stat label="Marks scored" value={acc.accuracy === null ? "–" : pct(acc.accuracy)} hint={acc.max ? `${acc.score} of ${acc.max}` : "no attempts yet"} />
        <Stat label="Cards due now" value={dueCards(data, Date.now()).length} hint={`${Object.keys(data.cards).length} cards started`} />
        <Stat label="Marked questions" value={data.marked.length} />
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
              const ids = idx.conceptsOf(u.id).map((c) => c.id);
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

      <section className="card">
        <h2>Weakest chapters</h2>
        {weakUnits.length ? (
          <ul className="list">
            {weakUnits.map((w) => (
              <li key={w.key}>
                {idx.unit(w.key)?.title ?? w.key}: {pct(w.acc.accuracy ?? 0)} over {w.acc.attempts} attempts
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
    </>
  );
}
