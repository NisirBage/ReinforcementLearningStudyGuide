// Pages for one concept or one content item, reached from search and cross-links.
import { Link, useParams } from "react-router-dom";
import { idx } from "../content/bundle";
import { isSupplementaryUnit } from "../content/schema";
import { STATUS_LABEL, statusOf } from "../domain/progress";
import { useProgress } from "../store/ProgressContext";
import { AlgorithmBox, EquationCard, ExampleCard, FigureView } from "../components/items";
import { QuestionCard } from "../components/QuestionCard";
import { Badge, ConceptLink, Flags, Md, PageTitle, Sources, StatusPicker, SupplementaryBanner } from "../components/ui";
import { NotFound } from "./NotFound";

const unitCrumb = (unit: string) => {
  const u = idx.unit(unit);
  return u ? <Link to={`/learn/${u.id}`}>{u.kind === "core" ? `Chapter ${u.core!.chapter}` : u.title}</Link> : unit;
};

export function ConceptPage() {
  const { id = "" } = useParams();
  const c = idx.concept(id);
  const { data, setStatus } = useProgress();
  if (!c) return <NotFound />;
  const chain = idx.prereqChain(c.id);
  const unlocks = idx.dependents(c.id);
  const eqs = idx.equationsFor(c.id);
  const algs = idx.algorithmsFor(c.id);
  const exs = idx.examplesFor(c.id);
  const figs = idx.figuresFor(c.id);
  const qs = idx.questionsFor(c.id);
  const status = statusOf(data, c.id);
  return (
    <>
      <p className="crumb">
        <Link to="/learn">Learn</Link> / {unitCrumb(c.unit)} / concept
      </p>
      <PageTitle title={c.title}>{c.title}</PageTitle>
      {isSupplementaryUnit(c.unit) && <SupplementaryBanner what="This concept" />}
      <p>
        <Badge>{c.kind}</Badge> {c.optional && <Badge>∗ optional</Badge>}
      </p>
      <Md text={c.summary} className="lede" />
      <div className="card status-card">
        <span>Your status:</span>
        <StatusPicker value={status} onChange={(s) => setStatus(c.id, s)} label={`Status of ${c.title}`} />
        <span className="muted small">{data.conceptStatus[c.id] ? `set ${new Date(data.conceptStatus[c.id].at).toLocaleDateString()}` : STATUS_LABEL[status]}</span>
      </div>
      <Flags flags={c.flags} />
      <Sources refs={c.sources} />
      <section className="card">
        <h2>How it connects</h2>
        <p>
          <strong>Learn first:</strong> {chain.length ? chain.map((p) => <ConceptLink key={p.id} id={p.id} />) : <span className="muted">no prerequisites in the app</span>}
        </p>
        <p>
          <strong>Leads to:</strong> {unlocks.length ? unlocks.map((d) => <ConceptLink key={d.id} id={d.id} />) : <span className="muted">nothing yet in the app</span>}
        </p>
        {c.related.length > 0 && (
          <p>
            <strong>Related:</strong> {c.related.map((r) => <ConceptLink key={r} id={r} />)}
          </p>
        )}
      </section>
      {eqs.map((e) => (
        <EquationCard key={e.id} e={e} compact />
      ))}
      {figs.map((f) => (
        <FigureView key={f.id} f={f} />
      ))}
      {algs.map((a) => (
        <AlgorithmBox key={a.id} a={a} />
      ))}
      {exs.map((x) => (
        <ExampleCard key={x.id} x={x} />
      ))}
      {qs.length > 0 && (
        <section>
          <h2>Exercises on this concept</h2>
          {qs.map((q, i) => (
            <QuestionCard key={q.id} q={q} index={i} />
          ))}
        </section>
      )}
    </>
  );
}

export function ItemPage({ kind }: { kind: "equation" | "algorithm" | "example" | "figure" }) {
  const { id = "" } = useParams();
  const item = kind === "equation" ? idx.equation(id) : kind === "algorithm" ? idx.algorithm(id) : kind === "example" ? idx.example(id) : idx.figure(id);
  if (!item) return <NotFound />;
  const title = "name" in item ? item.name : item.title;
  const concepts = "concept" in item ? [item.concept] : item.concepts;
  return (
    <>
      <p className="crumb">
        <Link to="/learn">Learn</Link> / {unitCrumb(item.unit)} / {kind}
      </p>
      <PageTitle title={title}>{title}</PageTitle>
      {isSupplementaryUnit(item.unit) && <SupplementaryBanner what={`This ${kind}`} />}
      {kind === "equation" && <EquationCard e={idx.equation(id)!} />}
      {kind === "algorithm" && <AlgorithmBox a={idx.algorithm(id)!} />}
      {kind === "example" && <ExampleCard x={idx.example(id)!} />}
      {kind === "figure" && <FigureView f={idx.figure(id)!} />}
      <p className="chips">
        <span className="muted small">Concept:</span> {concepts.map((c) => <ConceptLink key={c} id={c} />)}
      </p>
    </>
  );
}
