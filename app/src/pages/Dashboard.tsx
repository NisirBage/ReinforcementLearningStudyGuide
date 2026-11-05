import { Link } from "react-router-dom";
import { cat } from "../content/load";
import { accuracyOf, completion, dueCards, STATUS_LABEL, weakest } from "../domain/progress";
import { useProgress } from "../store/ProgressContext";
import { Bar, Empty, PageTitle, Stat, pct } from "../components/ui";

const coreConcepts = () => cat.catalog.concepts.filter((c) => !c.unit.startsWith("sup-")).map((c) => c.id);
const nameOf = (key: string) => cat.concept(key)?.title ?? cat.unit(key)?.title ?? key;

export function Dashboard() {
  const { data } = useProgress();
  const now = Date.now();
  const acc = accuracyOf(data.attempts);
  const core = coreConcepts();
  const done = completion(data, core);
  const due = dueCards(data, now).length;
  const needsRevision = Object.entries(data.conceptStatus).filter(([, s]) => s.status === "needs-revision").length;
  const weak = weakest(data.attempts, "concept", 3).filter((w) => (w.acc.accuracy ?? 1) < 0.8).slice(0, 5);
  const withContent = cat.units.filter((u) => u.kind === "core" && cat.conceptsOf(u.id).length > 0);

  return (
    <>
      <PageTitle title="Home">Reinforcement learning, from the 2015 draft</PageTitle>
      <p className="lede">
        Core text: Sutton &amp; Barto, <em>Reinforcement Learning: An Introduction</em>, 2nd edition, draft of April 2015. Supplementary
        material from Zhao's book, lectures and papers is labelled wherever it appears.
      </p>

      {data.lastVisited && (
        <section className="card continue">
          <h2>Continue learning</h2>
          <Link className="btn btn-primary" to={data.lastVisited.path}>
            {data.lastVisited.title}
          </Link>
        </section>
      )}

      <section className="stats" aria-label="Summary">
        <Stat label="Core concepts understood or mastered" value={`${core.filter((c) => ["understood", "mastered"].includes(data.conceptStatus[c]?.status ?? "")).length} / ${core.length}`} hint={pct(done)} />
        <Stat label="Questions attempted" value={acc.attempted} hint={`${acc.attempts} attempts`} />
        <Stat label="Marks scored" value={acc.accuracy === null ? "–" : pct(acc.accuracy)} hint={acc.max ? `${acc.score} of ${acc.max}` : "no attempts yet"} />
        <Stat label="Revision due" value={due + needsRevision} hint={`${due} cards due · ${needsRevision} marked “${STATUS_LABEL["needs-revision"]}”`} />
      </section>

      <section className="card">
        <h2>Syllabus coverage</h2>
        <Bar value={done} label="Share of core concepts understood or mastered" />
        <p className="muted small">
          Counts only concepts available in the app. So far {withContent.length} of {cat.units.filter((u) => u.kind === "core").length} chapters have learning material.
        </p>
        <ul className="list">
          {withContent.map((u) => {
            const ids = cat.conceptsOf(u.id).map((c) => c.id);
            return (
              <li key={u.id}>
                <Link to={`/learn/${u.id}`}>
                  Chapter {u.core!.chapter}: {u.title}
                </Link>{" "}
                <span className="muted">· {pct(completion(data, ids))} of {ids.length} concepts</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card">
        <h2>Weakest concepts</h2>
        {weak.length ? (
          <ul className="list">
            {weak.map((w) => (
              <li key={w.key}>
                <Link to={`/concept/${w.key}`}>{nameOf(w.key)}</Link> <span className="muted">· {pct(w.acc.accuracy ?? 0)} of marks over {w.acc.attempts} attempts</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No weak spots identified yet. A concept appears here after at least three attempts with under 80% of the marks.</Empty>
        )}
      </section>

      <section className="card">
        <h2>Recent activity</h2>
        {data.activity.length ? (
          <ul className="list">
            {data.activity.slice(0, 8).map((a, i) => (
              <li key={i}>
                <span className="muted">{new Date(a.at).toLocaleString()}</span> · {a.kind === "lesson" ? "Opened" : a.kind === "attempt" ? "Answered" : a.kind === "review" ? "Reviewed" : "Set status of"}{" "}
                {a.kind === "lesson" ? a.detail : a.kind === "status" ? `${nameOf(a.ref)} to ${STATUS_LABEL[a.detail as keyof typeof STATUS_LABEL] ?? a.detail}` : a.ref}
                {a.kind === "attempt" && <span className="muted"> ({a.detail})</span>}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            Nothing yet. Start with <Link to="/learn/ch02">Chapter 2, Multi-arm Bandits</Link>.
          </Empty>
        )}
      </section>
    </>
  );
}
