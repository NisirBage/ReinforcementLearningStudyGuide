// What the learner has entered for one question, before it is graded. Pure, shared by the lesson cards,
// Practice and (Milestone 3C) mock exams, so every place collects and grades answers the same way.
import { SELF_MARKED_TYPES, type Question } from "../content/schema";
import { gradeQuestion, parseNumber, type Grade, type Response } from "./grade";
import { makeRng, shuffle } from "./random";

export interface Draft {
  choice: number | null; // mcq
  choices: number[]; // multi
  tf: boolean | null; // true-false
  texts: string[]; // numeric parts, as typed
  order: number[]; // ordering: option indices in the order the learner arranged them
  text: string; // derivation / short-answer: the learner's own working (kept on the device, never graded by the app)
  ticks: boolean[]; // derivation / short-answer: rubric points the learner says they met
  selfScore: number | null; // derivation / short-answer without a rubric: the learner's own mark
  touched: boolean; // the learner has changed something (needed for ordering, which always has an order)
}

export const isSelfMarked = (q: Pick<Question, "type">) => (SELF_MARKED_TYPES as readonly string[]).includes(q.type);

/** A stable per-question shuffle, so an ordering question never starts already solved. */
export function scrambledOrder(q: Question): number[] {
  const n = q.options?.length ?? 0;
  let order = shuffle([...Array(n).keys()], makeRng([...q.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)));
  if (n > 1 && order.every((v, i) => v === i)) order = [...order.slice(1), order[0]];
  return order;
}

export const emptyDraft = (q: Question): Draft => ({
  choice: null,
  choices: [],
  tf: null,
  texts: (q.parts ?? []).map(() => ""),
  order: q.type === "ordering" ? scrambledOrder(q) : [],
  text: "",
  ticks: (q.rubric ?? []).map(() => false),
  selfScore: null,
  touched: false,
});

/** Has the learner given an answer? Unanswered questions count as unattempted, not as wrong. */
export function isAnswered(q: Question, d: Draft): boolean {
  switch (q.type) {
    case "mcq":
      return d.choice !== null;
    case "multi":
      return d.choices.length > 0;
    case "true-false":
      return d.tf !== null;
    case "numeric":
    case "multi-numeric":
      return d.texts.some((t) => t.trim() !== "");
    case "ordering":
      return d.touched;
    case "derivation":
    case "short-answer":
      return d.text.trim() !== "" || d.touched;
  }
}

export function toResponse(q: Question, d: Draft): Response {
  switch (q.type) {
    case "mcq":
      return { type: "mcq", choice: d.choice };
    case "multi":
      return { type: "multi", choices: d.choices };
    case "true-false":
      return { type: "true-false", value: d.tf };
    case "numeric":
    case "multi-numeric":
      return { type: "numeric", values: d.texts.map(parseNumber) };
    case "ordering":
      return { type: "ordering", order: d.order };
    case "derivation":
    case "short-answer":
      return q.rubric?.length ? { type: "rubric", ticks: d.ticks } : { type: "derivation", selfScore: d.selfScore };
  }
}

export const gradeDraft = (q: Question, d: Draft): Grade => gradeQuestion(q, toResponse(q, d));

/** Moves step i of an ordering answer up (-1) or down (+1). */
export function moveStep(d: Draft, i: number, dir: -1 | 1): Draft {
  const j = i + dir;
  if (j < 0 || j >= d.order.length) return d;
  const order = [...d.order];
  [order[i], order[j]] = [order[j], order[i]];
  return { ...d, order, touched: true };
}
