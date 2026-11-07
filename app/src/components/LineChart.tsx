// A small line chart for the laboratories: one y-axis, up to four series in fixed colour order (validated for light
// and dark themes), a legend plus direct labels at the line ends, a recessive grid, a hover crosshair with a tooltip,
// and a table view. Presentation only. A value that is not finite is a gap: the line breaks there (Figure 2.5's
// methods cover different parameter ranges), and `xLabels` names categorical x positions such as 1/128 … 4.
import { useId, useMemo, useState, type PointerEvent } from "react";

export interface Series {
  label: string;
  short?: string; // direct label at the line end (defaults to label)
  values: ArrayLike<number>;
}

/** Round tick values (1, 2 or 5 × 10^k apart) covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, target = 5): number[] {
  const raw = (hi - lo) / Math.max(1, target - 1);
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

interface Props {
  title: string;
  series: Series[];
  xLabel: string;
  yLabel: string;
  format: (y: number) => string;
  yMin?: number;
  yMax?: number;
  reference?: { y: number; label: string }; // a dashed horizontal line, e.g. the best possible average reward
  tableEvery?: number; // rows of the table view: every k-th x
  xFrom?: number; // x value of the first point (default 1: steps, episodes, sweeps); 0 for e.g. capital 0…100
  xLabels?: string[]; // one label per x position, shown under every point and in the table (replaces xFrom numbering)
}

const W = 640;
const H = 260;
const M = { l: 48, r: 96, t: 12, b: 34 };
const MAX_POINTS = 300;

export function LineChart({ title, series, xLabel, yLabel, format, yMin, yMax, reference, tableEvery, xFrom = 1, xLabels }: Props) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const n = Math.max(0, ...series.map((s) => s.values.length));
  const { lo, hi } = useMemo(() => {
    let a = Infinity;
    let b = -Infinity;
    for (const s of series) for (let i = 0; i < s.values.length; i++) if (Number.isFinite(s.values[i])) (a = Math.min(a, s.values[i])), (b = Math.max(b, s.values[i]));
    if (reference) (a = Math.min(a, reference.y)), (b = Math.max(b, reference.y));
    a = yMin ?? a;
    b = yMax ?? b;
    if (!(b > a)) (a -= 1), (b += 1);
    // Extend to round tick values so the axis reads cleanly.
    const t = niceTicks(a, b);
    const st = t.length > 1 ? t[1] - t[0] : 1;
    if (yMin === undefined) a = Math.min(a, Math.floor(a / st) * st);
    if (yMax === undefined) b = Math.max(b, Math.ceil(b / st) * st);
    return { lo: a, hi: b };
  }, [series, yMin, yMax, reference]);
  const x = (i: number) => M.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - M.l - M.r));
  const y = (v: number) => M.t + (1 - (v - lo) / (hi - lo)) * (H - M.t - M.b);
  const ticks = niceTicks(lo, hi);
  const step = Math.max(1, Math.ceil(n / MAX_POINTS));
  const path = (vals: ArrayLike<number>) => {
    let d = "";
    let pen = false; // false after a gap: the next point starts a new piece
    const to = (i: number) => {
      if (!Number.isFinite(vals[i])) return void (pen = false);
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(vals[i]).toFixed(1)}`;
      pen = true;
    };
    for (let i = 0; i < vals.length; i += step) to(i);
    if ((vals.length - 1) % step) to(vals.length - 1);
    return d;
  };
  /** Index of the last finite value, or -1. */
  const lastIndex = (vals: ArrayLike<number>) => {
    for (let i = vals.length - 1; i >= 0; i--) if (Number.isFinite(vals[i])) return i;
    return -1;
  };
  const fmt = (v: number) => (Number.isFinite(v) ? format(v) : "–");
  const xName = (i: number) => (xLabels ? xLabels[i] : String(i + xFrom));
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - M.l) / (W - M.l - M.r)) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  };
  // Direct labels at the line ends. Lines that reach the right edge are labelled in the margin, nudged apart so they
  // never overlap; a line that stops earlier (a gap to the end) is labelled beside its own last point instead.
  const lasts = series.map((s) => lastIndex(s.values));
  const atEdge = (k: number) => lasts[k] < 0 || lasts[k] === n - 1;
  const ends = [
    ...series
      .map((s, k) => ({ k, xx: W - M.r + 6, yy: lasts[k] < 0 ? y(lo) : y(s.values[lasts[k]]) }))
      .filter((e) => atEdge(e.k))
      .sort((a, b) => a.yy - b.yy)
      .reduce<{ k: number; xx: number; yy: number }[]>((acc, e) => [...acc, { ...e, yy: acc.length ? Math.max(e.yy, acc[acc.length - 1].yy + 13) : e.yy }], []),
    ...series.map((s, k) => ({ k, xx: x(lasts[k]) + 6, yy: y(s.values[lasts[k]]) })).filter((e) => !atEdge(e.k)),
  ];
  const every = tableEvery ?? Math.max(1, Math.round(n / 10));
  // Table rows on round x values (10, 20, … for steps from 1; 0, 10, … for x from 0), plus the last point.
  const rows = Array.from({ length: n }, (_, i) => i).filter((i) => xLabels !== undefined || (i + xFrom) % every === 0 || i === n - 1);

  return (
    <figure className="chart" aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className="chart-title">
        {title}
      </figcaption>
      {series.length > 1 && (
        <ul className="chart-legend">
          {series.map((s, k) => (
            <li key={k}>
              <span className={`swatch s${k + 1}`} aria-hidden="true" /> {s.label}
            </li>
          ))}
        </ul>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${yLabel} against ${xLabel}; see the table for the values`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((t, k) => (
          <g key={k} className="grid">
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} />
            <text x={M.l - 6} y={y(t) + 4} textAnchor="end">
              {format(t)}
            </text>
          </g>
        ))}
        {xLabels ? (
          xLabels.map((l, i) => (
            <text key={i} className="axis-label" x={x(i)} y={H - M.b + 14} textAnchor="middle">
              {l}
            </text>
          ))
        ) : (
          <>
            <text className="axis-label" x={M.l} y={H - 6}>
              {xFrom}
            </text>
            <text className="axis-label" x={W - M.r} y={H - 6} textAnchor="end">
              {n - 1 + xFrom}
            </text>
          </>
        )}
        <text className="axis-label" x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle">
          {xLabel}
        </text>
        {reference && (
          <g className="reference">
            <line x1={M.l} x2={W - M.r} y1={y(reference.y)} y2={y(reference.y)} />
            <text x={M.l + 4} y={y(reference.y) - 4}>
              {reference.label}
            </text>
          </g>
        )}
        {series.map((s, k) => (
          <path key={k} className={`line s${k + 1}`} d={path(s.values)} />
        ))}
        {ends.map(({ k, xx, yy }) => (
          <text key={k} className="end-label" x={xx} y={yy + 4}>
            {(() => {
              const s = series[k].short ?? series[k].label;
              return s.length > 14 ? s.slice(0, 13) + "…" : s;
            })()}
          </text>
        ))}
        {hover !== null && (
          <g className="hover">
            <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={H - M.b} />
            {series.map((s, k) =>
              Number.isFinite(s.values[hover]) ? <circle key={k} className={`dot s${k + 1}`} cx={x(hover)} cy={y(s.values[hover])} r={4} /> : null,
            )}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="chart-tip" role="status">
          <strong>
            {xLabel} {xName(hover)}
          </strong>
          {series.map((s, k) => (
            <span key={k}>
              <span className={`swatch s${k + 1}`} aria-hidden="true" /> {s.label}: {fmt(s.values[hover])}
            </span>
          ))}
        </div>
      )}
      <details className="chart-table">
        <summary>Show as a table</summary>
        <table className="breakdown">
          <thead>
            <tr>
              <th scope="col">{xLabel}</th>
              {series.map((s, k) => (
                <th key={k} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i}>
                <th scope="row">{xName(i)}</th>
                {series.map((s, k) => (
                  <td key={k}>{fmt(s.values[i])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
