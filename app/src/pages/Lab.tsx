// The Interactive Lab: a hub listing the laboratories, and one page per laboratory. The description, guide,
// sources, flags and verification come from content/labs/*.json; the computation is in lib/rl.
import { useEffect, type ReactElement } from "react";
import { Link, useParams } from "react-router-dom";
import { cat, useContent } from "../content/load";
import type { Lab } from "../content/schema";
import { Badge, ConceptLink, PageTitle, Sources, SupplementaryBanner } from "../components/ui";
import { Flags, Md } from "../components/math";
import { BanditLab } from "./labs/BanditLab";
import { BellmanLab } from "./labs/BellmanLab";
import { MdpExplorer } from "./labs/MdpExplorer";
import { DpLab } from "./labs/DpLab";
import { McLab } from "./labs/McLab";
import { TdLab } from "./labs/TdLab";
import { NotFound } from "./NotFound";
import { useProgress } from "../store/ProgressContext";

const BODIES: Record<string, () => ReactElement> = { bandit: BanditLab, mdp: MdpExplorer, bellman: BellmanLab, dp: DpLab, mc: McLab, td: TdLab };

export function LabHub() {
  const labs = cat.catalog.labs;
  return (
    <>
      <PageTitle title="Interactive Lab">Interactive Lab</PageTitle>
      <p className="lede">
        Computational experiments on the methods of the April 2015 draft. They run on this device, with every intermediate value shown, and each lab is checked against the draft's own examples.
      </p>
      <div className="tiles">
        {labs.map((l) => (
          <Link key={l.id} className="tile" to={`/lab/${l.slug}`}>
            <strong>{l.title}</strong>
            <span>{cat.unit(l.unit)?.kind === "core" ? `Chapter ${cat.unit(l.unit)!.core!.chapter}` : cat.unit(l.unit)?.title}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

export function LabPage() {
  const { slug = "" } = useParams();
  const stub = cat.catalog.labs.find((l) => l.slug === slug);
  if (!stub || !BODIES[slug]) return <NotFound />;
  return <LabBody unit={stub.unit} slug={slug} />;
}

function LabBody({ unit, slug }: { unit: string; slug: string }) {
  const idx = useContent([unit]);
  const lab = idx.lab(slug)!;
  const Body = BODIES[slug];
  const { openLab } = useProgress();
  useEffect(() => openLab(slug, lab.title), [slug]); // eslint-disable-line react-hooks/exhaustive-deps -- once per lab opened
  return (
    <>
      <p className="crumb">
        <Link to="/lab">Lab</Link> / {lab.title}
      </p>
      <PageTitle title={lab.title}>{lab.title}</PageTitle>
      {unit.startsWith("sup-") && <SupplementaryBanner what="This lab" />}
      <Md text={lab.summary} className="lede" />
      <About lab={lab} />
      <Body />
    </>
  );
}

function About({ lab }: { lab: Lab }) {
  return (
    <details className="card">
      <summary>
        What to try, sources and verification <Badge tone="ok">checked against the draft</Badge>
      </summary>
      <ol>
        {lab.guide.map((g, i) => (
          <li key={i}>
            <Md text={g} />
          </li>
        ))}
      </ol>
      <p className="chips">
        <span className="muted small">Concepts:</span> {lab.concepts.map((c) => <ConceptLink key={c} id={c} />)}
      </p>
      <p className="small">
        Sections:{" "}
        {lab.sections.map((s, i) => (
          <span key={s}>
            {i ? ", " : ""}
            <Link to={`/learn/${lab.unit.startsWith("sup-") ? lab.unit : `ch${s.split(".")[0].padStart(2, "0")}`}/${s}`}>§{s}</Link>
          </span>
        ))}
      </p>
      <p className="small muted">
        Verified by the automated checks {[lab.verification.check, ...(lab.checks ?? [])].filter(Boolean).join(", ")}, which reproduce the draft's examples with the same code this page runs.
        {lab.verification.note ? ` ${lab.verification.note}` : ""}
      </p>
      <Flags flags={lab.flags} />
      <Sources refs={lab.sources} label="Based on" />
    </details>
  );
}
