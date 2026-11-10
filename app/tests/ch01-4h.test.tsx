// @vitest-environment jsdom
// Milestone 4H: Chapter 1 completed to the coverage criteria. The tic-tac-toe player of §1.5 (rules, symmetries, exact
// values against a known opponent, the learner of Figure 1.1, self-play, minimax), its laboratory, and the Chapter 1
// lessons, flags and coverage.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { preloadAll, renderApp } from "./helpers";
import { renderMarkdown, texHasError } from "../src/lib/render";
import { loadBundle, loadCoverageInputs } from "../../tools/content_loader.ts";
import { computeCoverage } from "../src/content/coverage";
import { makeRng } from "../src/domain/random";
import * as T from "../src/lib/rl/envs/tictactoe";

beforeAll(preloadAll);
afterEach(cleanup);
const settled = async () => {
  const h = await screen.findByRole("heading", { level: 1 });
  await waitFor(() => expect(document.activeElement).toBe(h));
  return h;
};
const bundle = loadBundle();

describe("tic-tac-toe rules and exact values", () => {
  test("wins, full boards and whose turn it is", () => {
    expect(T.winner("XXXOO....")).toBe("X");
    expect(T.winner("XOXOXOOXO")).toBe(null);
    expect(T.isTerminal("XOXOXOOXO")).toBe(true);
    expect(T.toMove(T.EMPTY)).toBe("X");
    expect(T.toMove("X........")).toBe("O");
    expect(T.moves("XO.......")).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });

  test("the 8 symmetries are distinct permutations, and a corner opening has 4 equivalent forms", () => {
    expect(new Set(T.SYMMETRIES.map((p) => p.join(""))).size).toBe(8);
    for (const p of T.SYMMETRIES) expect([...p].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(["X........", "..X......", "......X..", "........X"].map(T.canonical)).size).toBe(1);
    expect(T.canonical("....X....")).toBe("....X....");
  });

  test("the best response wins 191/192 against the random opponent and 89/96 against the defensive one", () => {
    expect(T.optimalWinProbability("random")).toBeCloseTo(191 / 192, 12);
    expect(T.optimalWinProbability("defensive")).toBeCloseTo(89 / 96, 12);
    const r = T.evaluatePolicy(T.bestMinimaxSafePolicy("defensive"), "defensive");
    expect(r.win + r.draw + r.loss).toBeCloseTo(1, 12);
    expect(r.loss).toBe(0);
  });

  test("the learner backs up only after greedy moves, unless told to learn from exploration", () => {
    const rng = makeRng(4);
    const L = T.newLearner();
    let explored = 0;
    let greedyBackups = 0;
    for (let g = 0; g < 300; g++) {
      const game = T.playLearningGame(L, "random", { epsilon: 0.5, alpha: 0.1 }, rng);
      const ours = Math.ceil((game.positions.length - 1) / 2);
      explored += game.exploratory.length;
      greedyBackups += game.updates;
      // one backup per greedy move after our first, plus one if the opponent ended the game
      const oppEnded = (game.positions.length - 1) % 2 === 0;
      const firstExplored = game.exploratory.includes(1) ? 1 : 0;
      expect(game.updates).toBe(ours - 1 - (game.exploratory.length - firstExplored) + (oppEnded ? 1 : 0));
    }
    expect(explored).toBeGreaterThan(0);
    expect(greedyBackups).toBeGreaterThan(0);
  });
});

describe("the tic-tac-toe laboratory", () => {
  test("is listed in the lab hub", async () => {
    renderApp("/lab");
    await settled();
    expect(screen.getByRole("link", { name: /Tic-tac-toe laboratory/ })).toBeInTheDocument();
  });

  test("training shows the learned policy's exact probability of winning beside the best possible, and the last game", async () => {
    const user = userEvent.setup();
    renderApp("/lab/tictactoe");
    await settled();
    const panel = screen.getByRole("heading", { name: /The §1\.5 player/ }).closest("section")!;
    await user.click(within(panel).getByRole("button", { name: "+2,000 games" }));
    await within(panel).findByText("2000 games played.", {}, { timeout: 20_000 });
    const table = within(panel).getByRole("table", { name: /evaluated exactly/ });
    expect(table).toHaveTextContent("99.48%");
    expect(within(panel).getByRole("table", { name: "Learned value of each first move" })).toBeInTheDocument();
    expect(within(panel).getAllByRole("table", { name: /^our move 1/ }).length).toBe(1);
    const mm = screen.getByRole("table", { name: /Probability of winning a game, by opponent/ });
    expect(mm).toHaveTextContent("87.50%");
  });
});

describe("Chapter 1 content", () => {
  const ch01 = (u: { unit: string }) => u.unit === "ch01";
  test("every section has a lesson whose maths renders, and the chapter is covered", () => {
    const lesson = bundle.lessons.find(ch01)!;
    expect(lesson.sections.map((s) => s.section)).toEqual(["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8"]);
    for (const s of lesson.sections) for (const l of s.layers) expect(texHasError(renderMarkdown(l.body)), `${s.id} ${l.layer}`).toBe(false);
    const { inventory, declarations } = loadCoverageInputs();
    const c = computeCoverage(bundle, inventory, declarations).find((x) => x.id === "1")!;
    expect(c.status).toBe("covered");
    expect(c.exercises.missing).toEqual([]);
  });

  test("unresolved and outdated cross-references in the draft are flagged, not corrected", () => {
    const flags = (id: string) => bundle.concepts.find((c) => c.id === id)!.flags!.map((f) => f.note).join(" ");
    expect(flags("ch01.reinforcement-learning")).toMatch(/Chapters \?\? and \?\?/);
    expect(flags("ch01.model-based-model-free")).toMatch(/Chapter 9/);
    expect(flags("ch01.tic-tac-toe")).toMatch(/§14\.1/);
    expect(flags("ch01.history-threads")).toMatch(/Chapter Y/);
  });
});
