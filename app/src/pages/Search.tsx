import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getSearchIndex } from "../content/bundle";
import { search, type DocType } from "../domain/search";
import { Badge, Empty, PageTitle } from "../components/ui";

const TYPE_LABEL: Record<DocType, string> = {
  chapter: "Chapter",
  section: "Section",
  unit: "Module",
  concept: "Concept",
  equation: "Equation",
  algorithm: "Algorithm",
  example: "Example",
  definition: "Definition",
  notation: "Notation",
  figure: "Figure",
};
const FILTERS: { key: string; label: string; types: DocType[] }[] = [
  { key: "all", label: "All", types: [] },
  { key: "concepts", label: "Concepts & definitions", types: ["concept", "definition"] },
  { key: "equations", label: "Equations", types: ["equation"] },
  { key: "algorithms", label: "Algorithms", types: ["algorithm"] },
  { key: "examples", label: "Examples & figures", types: ["example", "figure"] },
  { key: "sections", label: "Chapters & sections", types: ["chapter", "section", "unit"] },
];

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [text, setText] = useState(q);
  const [filter, setFilter] = useState("all");
  const [core, setCore] = useState(false);
  const hits = useMemo(() => (q.trim() ? search(getSearchIndex(), q, 60) : []), [q]);
  const types = FILTERS.find((f) => f.key === filter)!.types;
  const shown = hits.filter((h) => (!types.length || types.includes(h.doc.type)) && (!core || h.doc.tier === "core"));
  const byId = new Map(hits.map((h) => [h.doc.id, h.doc]));

  return (
    <>
      <PageTitle title={q ? `Search: ${q}` : "Search"}>Search</PageTitle>
      <form
        role="search"
        className="searchform"
        onSubmit={(e) => {
          e.preventDefault();
          setParams(text.trim() ? { q: text.trim() } : {});
        }}
      >
        <label htmlFor="q" className="sr-only">
          Search terms
        </label>
        <input id="q" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Bellman equation, UCB, incremental update, Figure 4.2" autoFocus />
        <button className="btn btn-primary" type="submit">
          Search
        </button>
      </form>
      <p className="muted small">Works offline. Abbreviations (UCB, TD, MDP, DP…) and small typos are understood. Results show where each item is in the book.</p>
      {q && (
        <div className="filters">
          <div className="seg" role="group" aria-label="Filter by kind">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" className={filter === f.key ? "on" : ""} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={core} onChange={(e) => setCore(e.target.checked)} /> 2015 draft only (hide supplementary)
          </label>
        </div>
      )}
      {q && (
        <p role="status" className="muted">
          {shown.length} result{shown.length === 1 ? "" : "s"} for “{q}”
        </p>
      )}
      {q && !shown.length && <Empty>Nothing matches. Try a broader word, or a section number such as 4.1.</Empty>}
      <ol className="results">
        {shown.map((h) => (
          <li key={h.doc.id} className={h.doc.tier === "supplementary" ? "is-sup" : ""}>
            <Link to={h.doc.href} className="result-title">
              {h.doc.title}
            </Link>
            <div className="result-meta">
              <Badge>{TYPE_LABEL[h.doc.type]}</Badge>
              {h.doc.tier === "supplementary" ? <Badge tone="sup">Supplementary</Badge> : <Badge tone="core">2015 draft</Badge>}
              <span className="ref">{h.doc.ref}</span>
            </div>
            {h.doc.body && <p className="result-body">{h.doc.body}</p>}
            {h.via && <p className="muted small">Related to “{byId.get(h.via)?.title}”</p>}
          </li>
        ))}
      </ol>
    </>
  );
}
