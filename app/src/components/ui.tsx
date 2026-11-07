// Small presentational components shared by every page. No business logic here.
// Nothing here renders maths, so pages without maths (dashboard, progress, settings) do not load KaTeX: see math.tsx.
import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { describeSource } from "../content/describe";
import type { SourceRef } from "../content/schema";
import { CONCEPT_STATUSES, STATUS_LABEL, type ConceptStatus } from "../domain/progress";
import { cat } from "../content/load";

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export function Badge({ children, tone = "neutral", title }: { children: ReactNode; tone?: "neutral" | "core" | "sup" | "warn" | "ok"; title?: string }) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  );
}

export function SupplementaryBanner({ what = "This material" }: { what?: string }) {
  return (
    <p className="supp-banner" role="note">
      <strong>Supplementary.</strong> {what} is not from the April 2015 Sutton &amp; Barto draft, the core text of this course. It comes from the source cited below.
    </p>
  );
}

export function Sources({ refs, label = "Source" }: { refs: SourceRef[]; label?: string }) {
  return (
    <div className="sources">
      <span className="sources-label">{label}</span>
      <ul>
        {refs.map((r, i) => (
          <li key={i}>
            {r.kind === "textbook" || r.kind === "textbook-matter" ? <Badge tone="core">2015 draft</Badge> : <Badge tone="sup">Supplementary</Badge>} {describeSource(r)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StatusPicker({ value, onChange, label }: { value: ConceptStatus; onChange: (s: ConceptStatus) => void; label: string }) {
  return (
    <label className={`status status-${value}`}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as ConceptStatus)} aria-label={label}>
        {CONCEPT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ConceptLink({ id }: { id: string }) {
  const c = cat.concept(id);
  if (!c) return <span className="muted">{id}</span>;
  return (
    <Link className={`chip ${c.unit.startsWith("sup-") ? "chip-sup" : ""}`} to={`/concept/${c.id}`}>
      {c.title}
    </Link>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div className="bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label={label}>
      <div className="bar-fill" style={{ width: pct(Math.max(0, Math.min(1, value))) }} />
    </div>
  );
}

/** Sets the document title and moves focus to the page heading after navigation (keyboard and screen-reader users). */
export function PageTitle({ children, title }: { children: ReactNode; title: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${title} · RL Study Lab`;
    ref.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <h1 ref={ref} tabIndex={-1}>
      {children}
    </h1>
  );
}

export function ConfirmButton({ label, confirm, onConfirm, className = "btn" }: { label: string; confirm: string; onConfirm: () => void; className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (window.confirm(confirm)) onConfirm();
      }}
    >
      {label}
    </button>
  );
}

const COVERAGE_LABEL: Record<string, [string, "ok" | "neutral" | "warn"]> = {
  covered: ["Covered", "ok"],
  partial: ["Partial", "neutral"],
  "not-started": ["Not started", "neutral"],
  unwritten: ["Unwritten in draft", "warn"],
};
/**
 * How much of a chapter or section the app covers, computed at build time (content/coverage.ts, D-042). "Covered"
 * means a lesson, every numbered equation and named example of the draft there, and at least one question.
 */
export function CoverageBadge({ status, what = "section" }: { status: string | undefined; what?: "section" | "chapter" }) {
  if (!status) return null;
  const [label, tone] = COVERAGE_LABEL[status] ?? [status, "neutral"];
  const why =
    status === "covered"
      ? `This ${what} has a lesson, every numbered equation and example of the draft${what === "chapter" ? ", every exercise" : ""} and practice questions.`
      : status === "unwritten"
        ? `The April 2015 draft has only a heading here; the app adds nothing in its place.`
        : status === "partial"
          ? `Some of this ${what}'s material is in the app, but not all of it yet.`
          : `None of this ${what}'s material is in the app yet.`;
  return (
    <Badge tone={tone} title={why}>
      <span className="sr-only">Coverage: </span>
      {label}
    </Badge>
  );
}
