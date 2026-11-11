// @vitest-environment jsdom
// Milestone 4J: Chapter 8 completed to the coverage criteria. The mazes, Dyna-Q and Dyna-Q+, prioritized sweeping,
// Q-planning, full against sample backups and trajectory sampling; the planning laboratory and its explainer demo; and
// the Chapter 8 lessons, flags and coverage (with §8.8 unwritten in the draft).
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { preloadAll, renderApp } from "./helpers";
import { renderMarkdown, texHasError } from "../src/lib/render";
import { loadBundle, loadCoverageInputs } from "../../tools/content_loader.ts";
import { computeCoverage } from "../src/content/coverage";
import { makeRng } from "../src/domain/random";
import * as P from "../src/lib/rl/planning";

beforeAll(preloadAll);
afterEach(cleanup);
const settled = async () => {
  const h = await screen.findByRole("heading", { level: 1 });
  await waitFor(() => expect(document.activeElement).toBe(h));
  return h;
};
const bundle = loadBundle();

describe("mazes and models", () => {
  test("the Dyna maze has 47 open states and a 14-step shortest path; walls and edges stop the agent", () => {
    const env = P.mazeEnv(P.DYNA_MAZE);
    expect(env.openStates).toBe(47);
    expect(P.shortestPath(env)).toBe(14);
    expect(env.step(env.start, 3).next).toBe(env.start); // left edge
    expect(env.step(2 * 9 + 1, 2).next).toBe(2 * 9 + 1); // (2,1) → wall at (2,2)
    expect(env.step(1 * 9 + 8, 0)).toEqual({ next: env.goal, reward: 1 });
  });

  test("the blocking and shortcut mazes change as in Figures 8.7 and 8.8", () => {
    const [b0, b1] = P.BLOCKING_MAZE.map(P.mazeEnv);
    const [s0, s1] = P.SHORTCUT_MAZE.map(P.mazeEnv);
    expect(P.shortestPath(b0)).toBeLessThan(P.shortestPath(b1)); // the short way is blocked
    expect(P.shortestPath(s1)).toBeLessThan(P.shortestPath(s0)); // a shortcut opens
  });

  test("Dyna-Q with n = 0 makes exactly one backup per step; with n = 5, six", () => {
    const env = P.mazeEnv(P.DYNA_MAZE);
    for (const n of [0, 5]) {
      const ag = P.newDynaAgent(env.n);
      P.dynaEpisodes(env, { n, alpha: 0.1, gamma: 0.95, epsilon: 0.1 }, 2, makeRng(1), ag);
      expect(ag.backups).toBe(ag.time * (1 + n));
    }
  });

  test("prioritized sweeping propagates the goal's value back along the path without random backups", () => {
    const env = P.mazeEnv(P.DYNA_MAZE);
    const ag = P.newDynaAgent(env.n);
    const pq = new Map<string, number>();
    const preds = Array.from({ length: env.n }, () => new Set<string>());
    const rng = makeRng(4);
    let s = env.start;
    for (let k = 0; k < 20_000; k++) {
      const r = P.prioritizedStep(env, ag, pq, preds, s, { n: 5, alpha: 1, gamma: 0.95, epsilon: 0.1, theta: 1e-4 }, rng);
      if (r.done) break;
      s = r.next;
    }
    // after the first episode, the pair into the goal is worth 1 and its predecessors γ, γ², …
    const into = [...preds[env.goal]][0].split(",").map(Number);
    expect(ag.Q[into[0]][into[1]]).toBeCloseTo(1, 12);
  });

  test("the sample-backup error formula of Figure 8.13", () => {
    expect(P.sampleBackupError(2, 1)).toBeCloseTo(Math.sqrt(0.5), 12);
    expect(P.sampleBackupError(100, 25)).toBeCloseTo(0.199, 3);
  });

  test("random tasks: full backups and the greedy start value are well defined", () => {
    const task = P.randomTask(50, 3, makeRng(2));
    const curve = P.trajectorySampling(task, "uniform", 400, 100, makeRng(3));
    expect(curve).toHaveLength(5);
    expect(curve.every(Number.isFinite)).toBe(true);
  });
});

describe("the planning laboratory", () => {
  test("is listed in the lab hub", async () => {
    renderApp("/lab");
    await settled();
    expect(screen.getByRole("link", { name: /Planning laboratory/ })).toBeInTheDocument();
  });

  test("Dyna-Q finishes an episode and shows the greedy policy; the curves and full-vs-sample panels render", async () => {
    const user = userEvent.setup();
    renderApp("/lab/planning");
    await settled();
    const dq = screen.getByRole("heading", { name: /Dyna-Q on the maze/ }).closest("section")!;
    await user.click(within(dq).getByRole("button", { name: "Finish episode" }));
    expect(within(dq).getByRole("status")).toHaveTextContent(/Episode 2, step 0; \d+ backups so far; the last episode took \d+ steps \(shortest: 14\)/);
    expect(within(dq).getByRole("table", { name: /greedy action in each state/ })).toHaveTextContent("↑");
    expect(screen.getByRole("heading", { name: /Full against sample backups/ })).toBeInTheDocument();
    const curves = screen.getByRole("heading", { name: /Learning curves/ }).closest("section")!;
    const runs = within(curves).getByLabelText("number of runs");
    await user.clear(runs);
    await user.type(runs, "1");
    await user.click(within(curves).getByRole("button", { name: "Run" }));
    await waitFor(() => expect(within(curves).getAllByText(/Steps per episode/).length).toBeGreaterThan(1), { timeout: 20_000 }); // the description and the chart's title
  });

  test("the Dyna-Q algorithm page embeds the maze demo", async () => {
    renderApp("/algorithm/alg.ch08.dyna-q");
    await settled();
    expect(screen.getByRole("heading", { name: /Dyna-Q on the maze/ })).toBeInTheDocument();
  });
});

describe("Chapter 8 content", () => {
  const ch08 = (u: { unit: string }) => u.unit === "ch08";
  test("every written section has a lesson whose maths renders, and the chapter is covered with §8.8 unwritten", () => {
    const lesson = bundle.lessons.find(ch08)!;
    expect(lesson.sections.map((s) => s.section)).toEqual(["8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "8.9"]);
    for (const s of lesson.sections) for (const l of s.layers) expect(texHasError(renderMarkdown(l.body)), `${s.id} ${l.layer}`).toBe(false);
    const { inventory, declarations } = loadCoverageInputs();
    const c = computeCoverage(bundle, inventory, declarations).find((x) => x.id === "8")!;
    expect(c.status).toBe("covered");
    expect(c.sections.find((s) => s.id === "8.8")!.status).toBe("unwritten");
    expect(c.exercises.declared).toEqual({ "8.1": "placeholder", "8.4": "lab-task", "8.7": "lab-task" });
    expect(c.exercises.missing).toEqual([]);
  });

  test("questionable source material and reproduction differences are flagged", () => {
    const flags = (id: string) => bundle.concepts.find((c) => c.id === id)!.flags!.map((f) => f.note).join(" ");
    expect(flags("ch08.planning")).toMatch(/Section 15\.6/);
    expect(flags("ch08.heuristic-search")).toMatch(/§14\.1/);
    expect(flags("ch08.trajectory-sampling")).toMatch(/large and long-lasting/);
    expect(bundle.examples.find((e) => e.id === "ex.ch08.prioritized-mazes")!.flags![0].type).toBe("replication-discrepancy");
  });
});
