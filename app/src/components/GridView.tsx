// A gridworld drawn as a table of cells: values, greedy-action arrows, the agent, start, goal, cliff and wind.
// Used by the DP, Monte Carlo and TD laboratories. Presentation only.

export const ARROW = ["↑", "↓", "→", "←"]; // in the order of the grid actions: up, down, right, left

interface Props {
  rows: number;
  cols: number;
  stateAt: (r: number, c: number) => number | null; // which state a cell shows (null: nothing)
  label: string; // accessible name
  values?: readonly number[];
  arrows?: readonly (readonly number[])[]; // actions to draw per state (several for ties)
  agent?: number | null;
  start?: number;
  goals?: readonly number[];
  terminal?: readonly boolean[];
  cliff?: readonly [number, number][];
  wind?: readonly number[];
  path?: readonly number[]; // states on a path to highlight
  digits?: number;
  marks?: Readonly<Record<number, string>>; // a letter per state (A, B, A′, B′ of Example 3.8)
}

export function GridView({ rows, cols, stateAt, label, values, arrows, agent, start, goals = [], terminal, cliff = [], wind, path = [], digits = 1, marks = {} }: Props) {
  const onPath = new Set(path);
  return (
    <div className="gridview" role="table" aria-label={label} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const s = stateAt(r, c);
        const isCliff = cliff.some(([cr, cc]) => cr === r && cc === c);
        const isGoal = s !== null && goals.includes(s);
        const isTerm = s !== null && !!terminal?.[s];
        const cls = ["gcell", isCliff ? "cliff" : "", isGoal ? "goal" : "", isTerm && !isGoal ? "term" : "", s === start ? "start" : "", s !== null && onPath.has(s) ? "path" : "", s !== null && s === agent ? "agent" : ""].filter(Boolean).join(" ");
        const v = s !== null && values ? values[s] : undefined;
        const arr = s !== null && arrows && !isTerm && !isCliff ? arrows[s] ?? [] : [];
        const mark = s !== null ? marks[s] : undefined;
        const name = `row ${r + 1}, column ${c + 1}${mark ? `, ${mark}` : ""}${isCliff ? ", cliff" : ""}${isGoal ? ", goal" : ""}${s === start ? ", start" : ""}${s !== null && s === agent ? ", agent here" : ""}${v !== undefined && Number.isFinite(v) ? `, value ${v.toFixed(digits)}` : ""}${arr.length ? `, best ${arr.map((a) => ["up", "down", "right", "left"][a]).join(" or ")}` : ""}`;
        return (
          <span key={i} className={cls} role="cell" aria-label={name}>
            {isCliff ? "" : isGoal ? "G" : s === start ? <b>S</b> : mark ? <b>{mark}</b> : null}
            {v !== undefined && !isCliff && Number.isFinite(v) && <span className="gv">{v.toFixed(digits)}</span>}
            {arr.length > 0 && <span className="ga">{arr.map((a) => ARROW[a]).join("")}</span>}
          </span>
        );
      })}
      {wind &&
        wind.map((w, c) => (
          <span key={`w${c}`} className="gwind" aria-hidden="true">
            {w}
          </span>
        ))}
    </div>
  );
}
