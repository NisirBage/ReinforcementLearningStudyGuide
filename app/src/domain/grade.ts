// Grading of practice answers. Pure; the UI only collects the response and shows the result.
import type { Question } from "../content/schema";

export type Response =
  | { type: "mcq"; choice: number | null }
  | { type: "multi"; choices: number[] }
  | { type: "true-false"; value: boolean | null }
  | { type: "numeric"; values: (number | null)[] } // numeric and multi-numeric, one value per part
  | { type: "ordering"; order: number[] } // indices into q.options as the learner arranged them
  | { type: "derivation"; selfScore: number | null }; // derivation and short-answer: self-marked against the model answer

export interface Grade {
  score: number;
  max: number;
  correct: boolean; // full marks
  parts?: boolean[]; // per numeric part, or per position for ordering
}

/** Parses a typed number, accepting a leading minus sign (incl. "−"), decimals and fractions such as "-7/4". */
export function parseNumber(text: string): number | null {
  const s = text.trim().replace(/[−–]/g, "-").replace(/\s+/g, "");
  if (!s) return null;
  const frac = /^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(s);
  if (frac) return Number(frac[2]) === 0 ? null : Number(frac[1]) / Number(frac[2]);
  return /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(s) ? Number(s) : null;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export function gradeQuestion(q: Question, r: Response): Grade {
  const max = q.marks;
  const all = (score: number, extra?: Partial<Grade>): Grade => ({ score, max, correct: score === max, ...extra });
  switch (q.type) {
    case "mcq":
      return all(r.type === "mcq" && r.choice === q.answer ? max : 0);
    case "multi": {
      const want = new Set(q.answer as number[]);
      const got = r.type === "multi" ? new Set(r.choices) : new Set<number>();
      return all(got.size === want.size && [...want].every((x) => got.has(x)) ? max : 0); // all or nothing
    }
    case "true-false":
      return all(r.type === "true-false" && r.value === q.answer ? max : 0);
    case "numeric":
    case "multi-numeric": {
      const parts = q.parts!;
      const vals = r.type === "numeric" ? r.values : [];
      const ok = parts.map((p, i) => vals[i] !== null && vals[i] !== undefined && Math.abs((vals[i] as number) - p.answer) <= p.tolerance + 1e-12);
      return all(round2((max * ok.filter(Boolean).length) / parts.length), { parts: ok });
    }
    case "ordering": {
      const n = q.options!.length;
      const order = r.type === "ordering" ? r.order : [];
      const ok = Array.from({ length: n }, (_, i) => order[i] === i); // options are stored in the correct order
      return all(ok.every(Boolean) ? max : 0, { parts: ok });
    }
    case "derivation":
    case "short-answer": {
      const s = r.type === "derivation" ? r.selfScore : null;
      return all(s === null ? 0 : Math.max(0, Math.min(max, s)));
    }
  }
}
