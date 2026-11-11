// @vitest-environment jsdom
// Milestone 3F: algorithm explainers (content, source extraction, the page and its demonstrations), the Practice
// deep links, and the progress summaries on the Progress page and dashboard.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { preloadAll, renderApp } from "./helpers";
import { memoryStore } from "../src/store/idb";
import { STORAGE_KEY, encodeSaved, exportProgress, mergeProgress, parseImport } from "../src/store/persistence";
import { renderMarkdown, texHasError } from "../src/lib/render";
import { extractFunction, loadImplementation, sourceFileFor } from "../src/lib/source";
import { DEMOS } from "../src/pages/Explainer";
import { DEMO_KEYS } from "../src/content/schema";
import { CHECKS } from "../src/content/checks";
import {
  emptyProgress, examSummary, labUse, openLab, questionSummary, recordAttempt, revisionBacklog, setConceptStatus, toggleBookmark, toggleMarked, topicMastery,
  type Attempt, type ExamRecord,
} from "../src/domain/progress";
import { loadBundle } from "../../tools/content_loader.ts";

beforeAll(preloadAll);
afterEach(cleanup);
const settled = async () => {
  const h = await screen.findByRole("heading", { level: 1 });
  await waitFor(() => expect(document.activeElement).toBe(h));
  return h;
};
const b = loadBundle();

describe("explainer content", () => {
  test("every algorithm has an explainer with a demonstration, and every text renders its maths", () => {
    expect(b.algorithms.length).toBe(18); // Milestone 4I added Figures 7.7, 7.10, 7.12 and 7.15; 4J Figures 8.1, 8.4 and 8.9
    for (const k of DEMO_KEYS) expect(DEMOS[k], k).toBeDefined();
    for (const a of b.algorithms) {
      const x = a.explainer!;
      expect(x, a.id).toBeDefined();
      const texts = [x.problem, x.example.text, ...x.advantages, ...x.limitations, ...x.comparisons.map((c) => c.point), ...(x.derivation ?? []).flatMap((d) => [`$$${d.tex}$$`, d.why]), DEMOS[x.demo].note];
      for (const t of texts) expect(texHasError(renderMarkdown(t)), `${a.id}: ${t.slice(0, 40)}`).toBe(false);
      if (x.example.check) expect(CHECKS[x.example.check], x.example.check).toBeDefined();
    }
  });

  test("no content string holds a control character (a JSON \\t or \\f written where \\\\tfrac or \\\\frac was meant)", () => {
    const bad: string[] = [];
    const walk = (x: unknown, at: string): void => {
      if (typeof x === "string") {
        if (/[\u0000-\u0009\u000b-\u001f]/.test(x)) bad.push(`${at}: ${x.slice(0, 50)}`);
      } else if (Array.isArray(x)) x.forEach((y, i) => walk(y, `${at}[${i}]`));
      else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) walk(v, `${at}.${k}`);
    };
    walk(b, "content");
    expect(bad).toEqual([]);
  });

  test("every algorithm's concept has practice questions", () => {
    const qs = b.questionFiles.flatMap((f) => f.questions);
    for (const a of b.algorithms) expect(qs.filter((q) => q.concepts.includes(a.concept)).length, a.concept).toBeGreaterThanOrEqual(2);
  });
});

describe("source extraction", () => {
  test("extractFunction takes the function and its comment, and nothing after it", () => {
    const src = ["import x from 'y';", "", "/** Adds. */", "export function add(a: number, b: { c: number }): number {", "  if (a) {", "    return a + b.c;", "  }", "  return 0;", "}", "", "export function other() {}", ""].join("\n");
    expect(extractFunction(src, "add")).toBe(["/** Adds. */", "export function add(a: number, b: { c: number }): number {", "  if (a) {", "    return a + b.c;", "  }", "  return 0;", "}"].join("\n"));
    expect(extractFunction(src, "missing")).toBeNull();
    expect(extractFunction(src, "ad")).toBeNull(); // whole names only
  });

  test("files are found from implementation keys", () => {
    expect(sourceFileFor("td.qLearningStep")).toBe("rl/td.ts");
    expect(sourceFileFor("envs.recyclingRobot")).toBe("rl/envs/recycling.ts");
    expect(sourceFileFor("envs.cliffWalking")).toBe("rl/envs/examples.ts");
  });

  test("every algorithm's implementation is shown in full", async () => {
    for (const a of b.algorithms) {
      const r = await loadImplementation(a.implementation);
      const name = a.implementation.split(".")[1];
      expect(r, a.implementation).not.toBeNull();
      expect(r!.code).toMatch(new RegExp(`export function ${name}\\b`));
      expect(r!.code.trimEnd().endsWith("}")).toBe(true);
    }
  });
});

describe("the explainer page", () => {
  test("Q-learning: eleven-part layout less the derivation, its source, a checked example, and the live stepper", async () => {
    const user = userEvent.setup();
    renderApp("/algorithm/alg.ch06.q-learning");
    expect(await settled()).toHaveTextContent("Q-learning");
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    for (const [i, t] of ["The problem", "What to know first", "The mathematics", "Pseudocode", "The code that runs it", "A worked example", "Try it, one step at a time", "Strengths and limitations", "Compared with related algorithms", "Practice"].entries())
      expect(headings).toContain(`${i + 1}. ${t}`);
    expect(await screen.findByLabelText("Source of td.qLearningStep")).toHaveTextContent("const bootstrap = maxQ(Q, mdp, next);");
    await user.click(screen.getByRole("button", { name: /Check these numbers/ }));
    expect(screen.getByText("✓ The code reproduces every number above.")).toBeInTheDocument();
    const demo = document.getElementById("x8")!; // section ids follow the eleven-part order, whichever parts are shown
    await user.click(within(demo).getByRole("button", { name: "Step" }));
    expect(demo.querySelector("pre.calc")!.textContent).toContain("max_a Q(S_t+1, a) = 0.000");
    const cmp = within(document.getElementById("x10")!).getByRole("table");
    expect(within(cmp).getByRole("link", { name: "Sarsa" })).toHaveAttribute("href", "/algorithm/alg.ch06.sarsa");
  });

  test("Sarsa's demonstration starts on Sarsa, and its practice link presets Practice", async () => {
    const user = userEvent.setup();
    renderApp("/algorithm/alg.ch06.sarsa");
    await settled();
    const demo = document.getElementById("x8")!;
    expect(within(demo).getByLabelText(/^Method/)).toHaveValue("sarsa");
    await user.click(within(demo).getByRole("button", { name: "Step" }));
    expect(demo.querySelector("pre.calc")!.textContent).toContain("A_t+1 = ");
    const link = screen.getByRole("link", { name: "Practise them in a session" });
    expect(link).toHaveAttribute("href", "/practice?concept=ch06.sarsa");
  });

  test("the gradient bandit shows its derivation, and the bandit boxes say the draft has no pseudocode box", async () => {
    renderApp("/algorithm/alg.ch02.gradient-bandit");
    await settled();
    expect(screen.getByRole("heading", { name: "4. Where the update comes from" })).toBeInTheDocument();
    expect(screen.getByText(/not as a pseudocode box/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "11. Practice" })).toBeInTheDocument();
  });

  test("Practice opened from an explainer has the chapter and topic chosen", async () => {
    renderApp("/practice?concept=ch06.q-learning");
    await settled();
    expect(screen.getByText(/^5 questions match/)).toBeInTheDocument(); // ch06-q004, q005, q006, and q015 and q027 (Milestone 4G)
  });

  test("Practice opened with a pool preset uses it", async () => {
    renderApp("/practice?pool=bookmarked");
    await settled();
    expect(screen.getByText(/^0 questions match/)).toBeInTheDocument();
  });

  test("an unknown algorithm is not found", async () => {
    renderApp("/algorithm/alg.nope");
    expect(await settled()).toHaveTextContent(/not found/i);
  });
});

const att = (qid: string, score: number, max: number, at: number, extra: Partial<Attempt> = {}): Attempt => ({ qid, unit: qid.split("-")[0], concepts: [], score, max, at, ...extra });

describe("progress summaries", () => {
  test("question summary counts by latest attempt and adds measured time", () => {
    const list = [att("ch02-q001", 0, 2, 1, { ms: 1000 }), att("ch02-q001", 2, 2, 2, { ms: 3000 }), att("ch02-q002", 1, 2, 3)];
    expect(questionSummary(list)).toEqual({ attempted: 2, attempts: 3, correct: 1, incorrect: 1, accuracy: 3 / 6, ms: 4000 });
    expect(questionSummary([])).toEqual({ attempted: 0, attempts: 0, correct: 0, incorrect: 0, accuracy: null, ms: 0 });
  });

  test("topic mastery sets the learner's status beside the evidence", () => {
    let p = emptyProgress();
    p = recordAttempt(p, att("q1", 1, 2, 1, { concepts: ["c"] }));
    p = recordAttempt(p, att("q1", 2, 2, 2, { concepts: ["c"] }));
    p = setConceptStatus(p, "c", "learning", 3);
    const qs = [{ id: "q1", concepts: ["c"] }, { id: "q2", concepts: ["c"] }, { id: "q3", concepts: ["d"] }];
    expect(topicMastery(p, ["c", "d", "e"], qs)).toEqual([
      { concept: "c", status: "learning", available: 2, attempted: 1, latest: 1 },
      { concept: "d", status: "not-started", available: 1, attempted: 0, latest: null },
      { concept: "e", status: "not-started", available: 0, attempted: 0, latest: null },
    ]);
  });

  test("the revision backlog joins due cards, flagged and incorrect questions and concepts to revise, without double counting", () => {
    let p = emptyProgress();
    p = recordAttempt(p, att("ch02-q001", 0, 2, 1));
    p = toggleMarked(p, "ch02-q001");
    p = toggleMarked(p, "ch02-q002");
    p = setConceptStatus(p, "ch02.ucb", "needs-revision", 2);
    p = { ...p, cards: { "card:ch02.ucb": { reps: 1, interval: 1, ease: 2.5, due: 5, lapses: 0, last: 4 }, "card:x": { reps: 1, interval: 1, ease: 2.5, due: 50, lapses: 0, last: 4 } } };
    const bl = revisionBacklog(p, 10);
    expect(bl).toEqual({ dueCards: ["card:ch02.ucb"], flagged: ["ch02-q001", "ch02-q002"], incorrect: ["ch02-q001"], needsRevision: ["ch02.ucb"], total: 4 });
  });

  test("exam summary: count, latest, best and average share of marks", () => {
    const exam = (id: string, at: number, scores: [number, number][]): ExamRecord => ({
      id, title: id, startedAt: at, submittedAt: at + 1, limitMs: 1, elapsedMs: 1, endedBy: "submitted", config: { units: [], difficulties: [], count: scores.length },
      items: scores.map(([score, max], i) => ({ qid: `q${i}`, unit: "ch02", section: null, concepts: [], difficulty: 1, max, score, answered: true, markedForReview: false, selfMarked: false, ms: 0 })),
    });
    expect(examSummary([])).toEqual({ count: 0, best: null, latest: null, average: null });
    const s = examSummary([exam("a", 1, [[1, 2], [1, 2]]), exam("b", 5, [[3, 4]])]);
    expect(s).toEqual({ count: 2, best: 0.75, latest: { id: "b", title: "b", at: 6, percent: 0.75 }, average: 0.625 });
  });

  test("lab use is logged once per visit and survives export and import", () => {
    let p = openLab(emptyProgress(), "td", "Temporal-difference laboratory", 1);
    p = openLab(p, "td", "Temporal-difference laboratory", 2); // same lab again: not logged twice in a row
    p = openLab(p, "dp", "Dynamic programming laboratory", 3);
    p = openLab(p, "td", "Temporal-difference laboratory", 4);
    expect(labUse(p)).toEqual([
      { slug: "td", title: "Temporal-difference laboratory", visits: 2, last: 4 },
      { slug: "dp", title: "Dynamic programming laboratory", visits: 1, last: 3 },
    ]);
    const back = parseImport(exportProgress(p, 10));
    expect(labUse(back)).toEqual(labUse(p));
    expect(labUse(mergeProgress(emptyProgress(), back))).toEqual(labUse(p));
  });
});

describe("progress pages", () => {
  const seeded = () => {
    let p = emptyProgress();
    p = recordAttempt(p, att("ch02-q001", 0, 3, 1000, { concepts: ["ch02.sample-average"], ms: 60_000 }));
    p = recordAttempt(p, att("ch02-q001", 1, 3, 2000, { concepts: ["ch02.sample-average"], ms: 30_000 }));
    p = recordAttempt(p, att("ch02-q002", 2, 2, 3000, { concepts: ["ch02.constant-step-size"], ms: 30_000 }));
    p = toggleBookmark(p, "ch02-q002");
    p = openLab(p, "bandit", "Multi-armed bandit laboratory", 4000);
    return memoryStore({ [STORAGE_KEY]: encodeSaved(p, 5000) });
  };

  test("the Progress page shows the counts, backlog, mistakes, bookmarks, mastery and labs from stored data", async () => {
    renderApp("/progress", seeded());
    await settled();
    const stats = await screen.findByRole("region", { name: "Questions" });
    await waitFor(() => expect(within(stats).getByText("Questions attempted").previousSibling).toHaveTextContent("2"));
    expect(within(stats).getByText("Correct").previousSibling).toHaveTextContent("1");
    expect(within(stats).getByText("Incorrect").previousSibling).toHaveTextContent("1");
    expect(within(stats).getByText("Time on questions").previousSibling).toHaveTextContent("2 min");
    const backlog = screen.getByRole("region", { name: "Revision backlog" });
    expect(within(backlog).getByRole("link", { name: "1 questions to re-attempt" })).toHaveAttribute("href", "/practice?pool=incorrect");
    const mistakes = screen.getByRole("region", { name: "Repeated mistakes and bookmarks" });
    expect(within(mistakes).getByText(/Chapter 2, question 1 \(§2\.\d\)/)).toHaveTextContent("wrong 2 of 2 times");
    expect(within(mistakes).getAllByRole("link", { name: "practise them" }).map((a) => a.getAttribute("href"))).toEqual(["/practice?pool=repeated", "/practice?pool=bookmarked"]);
    expect(within(mistakes).getByText(/1 bookmarked question/)).toBeInTheDocument();
    const mastery = screen.getByRole("region", { name: "Topic mastery" });
    const concept = b.questionFiles.flatMap((f) => f.questions).find((q) => q.id === "ch02-q001")!.concepts[0];
    const title = b.concepts.find((c) => c.id === concept)!.title;
    const row = within(mastery).getAllByRole("row").find((r) => r.querySelector("th")?.textContent === title)!;
    expect(row.textContent).toMatch(/[12] of \d+/); // attempted questions on the concept of ch02-q001
    const labs = screen.getByRole("region", { name: "Laboratories used" });
    expect(within(labs).getByRole("link", { name: "Multi-armed bandit laboratory" })).toBeInTheDocument();
  });

  test("the dashboard shows the backlog and labels lab and exam activity", async () => {
    renderApp("/", seeded());
    await settled();
    await waitFor(() => expect(screen.getByText("Revision backlog").previousSibling).toHaveTextContent("1"));
    expect(screen.getByText(/Used the Multi-armed bandit laboratory/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Full progress/ })).toHaveAttribute("href", "/progress");
  });

  test("opening a lab adds it to the activity log", async () => {
    const store = memoryStore();
    renderApp("/lab/dp", store);
    await settled();
    await waitFor(() => expect(Object.values(store.dump()).join("")).toContain("Dynamic programming laboratory"));
  });
});
