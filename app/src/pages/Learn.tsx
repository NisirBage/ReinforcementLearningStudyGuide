// Chapter list, unit pages and section pages.
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { cat, useContent } from "../content/load";
import { isSupplementaryUnit } from "../content/schema";
import { completion, statusOf, type ConceptStatus } from "../domain/progress";
import { useProgress } from "../store/ProgressContext";
import { AlgorithmBox, EquationCard, ExampleCard, FigureView } from "../components/items";
import { QuestionCard } from "../components/QuestionCard";
import { Badge, ConceptLink, Empty, PageTitle, Sources, StatusPicker, SupplementaryBanner, pct } from "../components/ui";
import { Md } from "../components/math";
import { NotFound } from "./NotFound";

const off = () => cat.catalog.sources.sb.pdfPageOffset ?? 0;
const pages = (a: number, b: number) => (a === b ? `p. ${a}` : `pp. ${a}–${b}`);
const zhaoName = (id: string) => (/^[A-D]$/.test(id) ? `Appendix ${id}` : `Chapter ${id}`);
const sbPages = (a: number, b: number) => `${pages(a, b)} (PDF ${a + off() === b + off() ? a + off() : `${a + off()}–${b + off()}`})`;

export function LearnIndex() {
  const { data } = useProgress();
  const parts = [null, ...cat.catalog.sources.sb.parts.map((p) => p.title)];
  const core = cat.units.filter((u) => u.kind === "core");
  return (
    <>
      <PageTitle title="Learn">Learn</PageTitle>
      <p className="lede">The chapters of the April 2015 draft, in order. Supplementary modules are listed separately below and are not part of the core syllabus.</p>
      {parts.map((part) => {
        const list = core.filter((u) => (u.chapter?.part ?? null) === part);
        if (!list.length) return null;
        return (
          <section key={part ?? "intro"}>
            {part && <h2 className="part">Part · {part}</h2>}
            <ul className="rows">
              {list.map((u) => {
                const concepts = cat.conceptsOf(u.id).map((c) => c.id);
                return (
                  <li key={u.id}>
                    <Link className="row" to={`/learn/${u.id}`}>
                      <span className="num">{u.core!.chapter}</span>
                      <span className="row-main">
                        {u.title}
                        <small>
                          {u.chapter && sbPages(u.chapter.startPage, u.chapter.endPage)} · {u.chapter?.sections.length ?? 0} sections
                          {concepts.length ? ` · ${concepts.length} concepts · ${pct(completion(data, concepts))} understood` : ""}
                        </small>
                      </span>
                      {u.status === "empty-in-draft" ? <Badge tone="warn">Empty in draft</Badge> : concepts.length ? <Badge tone="ok">Material</Badge> : <Badge>Outline only</Badge>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <section>
        <h2 className="part">Supplementary modules (not in the 2015 draft)</h2>
        <ul className="rows">
          {cat.units
            .filter((u) => u.kind === "supplementary")
            .map((u) => (
              <li key={u.id}>
                <Link className="row row-sup" to={`/learn/${u.id}`}>
                  <span className="num">S</span>
                  <span className="row-main">
                    {u.title}
                    <small>Attached to {u.sup!.attachTo.section ? `§${u.sup!.attachTo.section}` : `Chapter ${u.sup!.attachTo.chapter}`} of the draft</small>
                  </span>
                  <Badge tone="sup">Supplementary</Badge>
                </Link>
              </li>
            ))}
        </ul>
      </section>
    </>
  );
}

function ConceptRow({ id }: { id: string }) {
  const { data, setStatus } = useProgress();
  const c = cat.concept(id)!;
  return (
    <li className="concept-row" id={c.id}>
      <Link to={`/concept/${c.id}`}>{c.title}</Link>
      <StatusPicker value={statusOf(data, c.id)} onChange={(s: ConceptStatus) => setStatus(c.id, s)} label={`Status of ${c.title}`} />
    </li>
  );
}

export function UnitPage() {
  const { unit = "" } = useParams();
  const u = cat.unit(unit);
  const { visit } = useProgress();
  useEffect(() => {
    if (u) visit(`/learn/${u.id}`, u.kind === "core" ? `Chapter ${u.core!.chapter}: ${u.title}` : u.title);
  }, [u, visit]);
  if (!u) return <NotFound />;
  return <UnitBody unitId={u.id} />;
}

function UnitBody({ unitId }: { unitId: string }) {
  const idx = useContent([unitId]); // suspends until this chapter's content is loaded
  const u = idx.unit(unitId)!;
  const sup = u.kind === "supplementary";
  const sections = idx.sectionsOf(u.id);
  const chapterLevel = idx.chapterLevel(u.id);
  const attached = u.kind === "core" ? idx.supplementsFor(u.core!.chapter) : [];
  const concepts = idx.conceptsOf(u.id);
  return (
    <>
      <p className="crumb">
        <Link to="/learn">Learn</Link> / {sup ? "Supplementary" : `Chapter ${u.core!.chapter}`}
      </p>
      <PageTitle title={u.title}>
        {sup ? "" : `${u.core!.chapter}. `}
        {u.title}
      </PageTitle>
      {sup ? (
        <SupplementaryBanner what="This module" />
      ) : (
        <p className="muted">
          Sutton &amp; Barto, April 2015 draft · {u.chapter && sbPages(u.chapter.startPage, u.chapter.endPage)}
          {u.chapter?.part ? ` · Part: ${u.chapter.part}` : ""}
        </p>
      )}
      {u.status === "empty-in-draft" && <p className="flag">⚑ {idx.emptyNote(u.core!.chapter, null)} The app adds nothing in its place.</p>}
      {sup && (
        <p className="muted">
          Sources: {[...(u.sup!.zhao ?? []).map((z) => `Zhao, Chapter ${z}`), ...(u.sup!.lectures ?? []).map((l) => `Lecture ${l.slice(1)}`), ...(u.sup!.papers ?? [])].join(" · ")}. Attached to{" "}
          <Link to={`/learn/ch${u.sup!.attachTo.chapter.padStart(2, "0")}${u.sup!.attachTo.section ? `/${u.sup!.attachTo.section}` : ""}`}>
            {u.sup!.attachTo.section ? `§${u.sup!.attachTo.section}` : `Chapter ${u.sup!.attachTo.chapter}`} of the draft
          </Link>
          .
        </p>
      )}

      {sections.length > 0 && (
        <section className="card">
          <h2>Sections</h2>
          <ol className="sections">
            {sections.map(({ book, chapter, section }) => {
              const content = idx.sectionContent(u.id, section.id);
              const n = content.concepts.length + content.equations.length + content.algorithms.length + content.examples.length + content.figures.length + content.questions.length;
              const empty = book === "sb" ? idx.emptyNote(chapter.id, section.id) : undefined;
              const span = idx.pagesOf(book, section.id);
              return (
                <li key={section.id} className={section.level === "subsection" ? "sub" : ""}>
                  <Link to={`/learn/${u.id}/${section.id}`}>
                    {section.id} {section.title}
                  </Link>
                  {section.optional && <Badge title="Marked ∗: can be skipped on first reading">∗ optional</Badge>}
                  {empty && <Badge tone="warn">Empty in draft</Badge>}
                  {content.lesson && <Badge tone="ok">Lesson</Badge>}
                  <span className="muted small">
                    {" "}
                    · {span ? (book === "sb" ? sbPages(span[0], span[1]) : pages(span[0], span[1])) : ""}
                    {n ? ` · ${n} item${n > 1 ? "s" : ""}` : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {concepts.length > 0 && (
        <section className="card">
          <h2>Concepts in this {sup ? "module" : "chapter"}</h2>
          <p className="muted small">Set your own status for each concept; it feeds the dashboard and revision.</p>
          <ul className="concepts">
            {concepts.map((c) => (
              <ConceptRow key={c.id} id={c.id} />
            ))}
          </ul>
        </section>
      )}

      {chapterLevel.questions.length > 0 && (
        <section>
          <h2>{sup ? "Exercises" : "End-of-chapter exercises"}</h2>
          {chapterLevel.questions.map((q, i) => (
            <QuestionCard key={q.id} q={q} index={i} />
          ))}
        </section>
      )}

      {attached.length > 0 && (
        <section className="card card-sup">
          <h2>Go further (supplementary)</h2>
          <ul className="list">
            {attached.map((s) => (
              <li key={s.id}>
                <Link to={`/learn/${s.id}`}>{s.title}</Link> <span className="muted small">· extends {s.attachTo.section ? `§${s.attachTo.section}` : `Chapter ${s.attachTo.chapter}`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!concepts.length && !chapterLevel.questions.length && u.status !== "empty-in-draft" && (
        <Empty>Learning material for this {sup ? "module" : "chapter"} has not been written yet. The section list above shows the draft's structure and pages.</Empty>
      )}
    </>
  );
}

const LAYER_LABEL: Record<string, string> = {
  intuition: "Intuition",
  formal: "Formal definition",
  math: "The mathematics",
  derivation: "Derivation",
  example: "Worked example",
  computation: "As an algorithm",
  connections: "Connections",
  practice: "Practice",
};

export function SectionPage() {
  const { unit = "", section = "" } = useParams();
  const u = cat.unit(unit);
  const list = u ? cat.sectionsOf(u.id) : [];
  const i = list.findIndex((s) => s.section.id === section);
  const { visit } = useProgress();
  const entry = list[i];
  useEffect(() => {
    if (u && entry) visit(`/learn/${u.id}/${entry.section.id}`, `§${entry.section.id} ${entry.section.title}`);
  }, [u, entry, visit]);
  if (!u || !entry) return <NotFound />;
  return <SectionBody unitId={u.id} index={i} />;
}

function SectionBody({ unitId, index: i }: { unitId: string; index: number }) {
  const idx = useContent([unitId]); // suspends until this chapter's content is loaded
  const u = idx.unit(unitId)!;
  const list = idx.sectionsOf(u.id);
  const { book, chapter, section: s } = list[i];
  const c = idx.sectionContent(u.id, s.id);
  const span = idx.pagesOf(book, s.id);
  const empty = book === "sb" ? idx.emptyNote(chapter.id, s.id) : undefined;
  const shownInLesson = new Set(c.lesson?.layers.flatMap((l) => l.refs ?? []) ?? []);
  const rest = {
    equations: c.equations.filter((e) => !shownInLesson.has(e.id)),
    algorithms: c.algorithms.filter((a) => !shownInLesson.has(a.id)),
    examples: c.examples.filter((x) => !shownInLesson.has(x.id)),
    figures: c.figures.filter((f) => !shownInLesson.has(f.id)),
  };
  const attached = book === "sb" ? idx.bundle.curriculum.supplementary.filter((x) => x.attachTo.section === s.id) : [];
  const toc = [
    c.lesson && ["lesson", "Lesson"],
    c.concepts.length && ["key-terms", "Key terms"],
    rest.equations.length && ["equations", "Equations"],
    rest.figures.length && ["figures", "Figures"],
    rest.algorithms.length && ["algorithms", "Pseudocode"],
    rest.examples.length && ["examples", "Worked examples"],
    c.questions.length && ["exercises", "Exercises"],
  ].filter(Boolean) as [string, string][];
  const prev = list[i - 1];
  const next = list[i + 1];
  const nothing = !c.lesson && !c.concepts.length && !c.equations.length && !c.algorithms.length && !c.examples.length && !c.figures.length && !c.questions.length;

  return (
    <>
      <p className="crumb">
        <Link to="/learn">Learn</Link> / <Link to={`/learn/${u.id}`}>{isSupplementaryUnit(u.id) ? u.title : `Chapter ${u.core!.chapter}`}</Link> / §{s.id}
      </p>
      <PageTitle title={`§${s.id} ${s.title}`}>
        {s.id} {s.title}
      </PageTitle>
      {isSupplementaryUnit(u.id) && <SupplementaryBanner what="This section" />}
      <p className="muted">
        {book === "sb" ? "Sutton & Barto, April 2015 draft" : `Zhao, ${zhaoName(chapter.id)}`} · {span ? (book === "sb" ? sbPages(span[0], span[1]) : `${pages(span[0], span[1])} (${zhaoName(chapter.id)} PDF ${span[0] - (chapter.pdf?.offset ?? 0)}–${span[1] - (chapter.pdf?.offset ?? 0)})`) : "page not listed"}
        {s.optional && " · marked ∗ (optional on first reading)"}
      </p>
      {empty && <p className="flag">⚑ {empty} The app adds nothing in its place.</p>}

      {toc.length > 1 && (
        <nav className="toc" aria-label="On this page">
          {toc.map(([id, label]) => (
            <a key={id} href={`#${id}`} onClick={(e) => (e.preventDefault(), document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), document.getElementById(id)?.focus())}>
              {label}
            </a>
          ))}
        </nav>
      )}

      {c.lesson && (
        <section id="lesson" tabIndex={-1} aria-label="Lesson">
          {c.lesson.layers.map((ly, j) => (
            <section key={j} className={`layer layer-${ly.layer}`}>
              <h2 className="layer-label">{LAYER_LABEL[ly.layer]}</h2>
              <Md text={ly.body} />
              {(ly.refs ?? []).map((r) => {
                const e = idx.equation(r);
                const a = idx.algorithm(r);
                const x = idx.example(r);
                const f = idx.figure(r);
                return e ? <EquationCard key={r} e={e} compact /> : a ? <AlgorithmBox key={r} a={a} /> : x ? <ExampleCard key={r} x={x} /> : f ? <FigureView key={r} f={f} /> : null;
              })}
            </section>
          ))}
          <Sources refs={c.lesson.sources} label="Lesson based on" />
        </section>
      )}

      {c.concepts.length > 0 && (
        <section id="key-terms" tabIndex={-1} className="card keyterms">
          <h2>Key terms</h2>
          <dl>
            {c.concepts.map((k) => (
              <div key={k.id}>
                <dt>
                  <Link to={`/concept/${k.id}`}>{k.title}</Link> <Badge>{k.kind}</Badge>
                </dt>
                <dd>
                  <Md text={k.summary} />
                  {k.prereqs.length > 0 && (
                    <p className="chips">
                      <span className="muted small">Needs:</span> {k.prereqs.map((p) => <ConceptLink key={p} id={p} />)}
                    </p>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <ul className="concepts">
            {c.concepts.map((k) => (
              <ConceptRow key={k.id} id={k.id} />
            ))}
          </ul>
        </section>
      )}

      {rest.equations.length > 0 && (
        <section id="equations" tabIndex={-1}>
          <h2>Equations</h2>
          {rest.equations.map((e) => (
            <EquationCard key={e.id} e={e} compact />
          ))}
        </section>
      )}
      {rest.figures.length > 0 && (
        <section id="figures" tabIndex={-1}>
          <h2>Figures</h2>
          {rest.figures.map((f) => (
            <FigureView key={f.id} f={f} />
          ))}
        </section>
      )}
      {rest.algorithms.length > 0 && (
        <section id="algorithms" tabIndex={-1}>
          <h2>Pseudocode</h2>
          {rest.algorithms.map((a) => (
            <AlgorithmBox key={a.id} a={a} />
          ))}
        </section>
      )}
      {rest.examples.length > 0 && (
        <section id="examples" tabIndex={-1}>
          <h2>Worked examples</h2>
          {rest.examples.map((x) => (
            <ExampleCard key={x.id} x={x} />
          ))}
        </section>
      )}
      {c.questions.length > 0 && (
        <section id="exercises" tabIndex={-1}>
          <h2>Exercises</h2>
          {c.questions.map((q, j) => (
            <QuestionCard key={q.id} q={q} index={j} />
          ))}
        </section>
      )}
      {nothing && !empty && <Empty>No learning material has been written for this section yet. Use the pages above to read it in the PDF.</Empty>}

      {attached.length > 0 && (
        <section className="card card-sup">
          <h2>Go further (supplementary)</h2>
          <ul className="list">
            {attached.map((x) => (
              <li key={x.id}>
                <Link to={`/learn/${x.id}`}>{x.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="pager" aria-label="Sections">
        {prev ? <Link to={`/learn/${u.id}/${prev.section.id}`}>← {prev.section.id} {prev.section.title}</Link> : <span />}
        {next ? <Link to={`/learn/${u.id}/${next.section.id}`}>{next.section.id} {next.section.title} →</Link> : <span />}
      </nav>
    </>
  );
}
