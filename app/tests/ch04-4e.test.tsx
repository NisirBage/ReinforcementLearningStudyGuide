// @vitest-environment jsdom
// Milestone 4E: Chapter 4 completed to the coverage criteria. Jack's car rental (Example 4.2, Exercise 4.5) in the
// library and the DP laboratory, the Chapter 4 lessons and coverage, and the flag on Figure 4.4's value axis.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { preloadAll, renderApp } from "./helpers";
import { renderMarkdown, texHasError } from "../src/lib/render";
import { loadBundle, loadCoverageInputs } from "../../tools/content_loader.ts";
import { computeCoverage } from "../src/content/coverage";
import { JACK_EXAMPLE, JACK_EXERCISE_4_5, feasible, jackActionValue, jackModel, locationTable, overnightCost, poissonFolded } from "../src/lib/rl/envs/jacksCarRental";

beforeAll(preloadAll);
afterEach(cleanup);
const settled = async () => {
  const h = await screen.findByRole("heading", { level: 1 });
  await waitFor(() => expect(document.activeElement).toBe(h));
  return h;
};
const bundle = loadBundle();
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("Jack's car rental model", () => {
  test("folded Poisson probabilities and the per-location tables are proper distributions", () => {
    expect(sum(poissonFolded(3, 5))).toBeCloseTo(1, 12);
    expect(poissonFolded(3, 0)).toEqual([1]); // with no cars, every request is lost: P(≥ 0) = 1
    const t = locationTable(3, 3, 20);
    for (const row of t.next) expect(sum(row)).toBeCloseTo(1, 12);
    expect(t.rented[0]).toBe(0);
    expect(t.rented[20]).toBeCloseTo(3, 6); // with plenty of cars, the expected rentals are the mean demand
  });

  test("moves must be feasible, and Exercise 4.5 changes only the overnight costs", () => {
    expect(feasible(3, 0, 3)).toBe(true);
    expect(feasible(3, 0, 4)).toBe(false);
    expect(feasible(0, 2, -2)).toBe(true);
    expect(overnightCost(JACK_EXAMPLE, 15, 5, 3)).toBe(6);
    expect(overnightCost(JACK_EXERCISE_4_5, 12, 8, 3)).toBe(4 + 4); // two paid moves, one lot over 10
    expect(overnightCost(JACK_EXERCISE_4_5, 9, 11, -2)).toBe(4 + 4); // moves towards the first location are all paid
  });

  test("an action value is the expected credit minus costs plus the discounted next value", () => {
    const m = jackModel(JACK_EXAMPLE);
    const zero = new Float64Array(441);
    const expected = 10 * (m.loc[0].rented[5] + m.loc[1].rented[5]);
    expect(jackActionValue(m, zero, 5, 5, 0)).toBeCloseTo(expected, 10);
    expect(jackActionValue(m, zero, 7, 3, 2)).toBeCloseTo(10 * (m.loc[0].rented[5] + m.loc[1].rented[5]) - 4, 10);
  });
});

describe("the dynamic programming laboratory's Jack's car rental panel", () => {
  test("steps through π0 … π4 of Figure 4.4 and solves Exercise 4.5's variant", async () => {
    const user = userEvent.setup();
    renderApp("/lab/dp");
    await settled();
    const panel = screen.getByRole("heading", { name: "Jack's car rental (Example 4.2)" }).closest("section")!;
    expect(within(panel).getByRole("status")).toHaveTextContent(/^π0: evaluated in \d+ sweeps/);
    await user.selectOptions(within(panel).getByRole("combobox", { name: /^Policy/ }), "4");
    expect(within(panel).getByRole("status")).toHaveTextContent("this policy is optimal");
    const grid = within(panel).getByRole("table", { name: /Policy π4/ });
    expect(within(grid).getByRole("cell", { name: "20 at the first location, 0 at the second: move 5" })).toBeInTheDocument();
    expect(within(grid).getByRole("cell", { name: "0 at the first location, 20 at the second: move -4" })).toBeInTheDocument();
    await user.selectOptions(within(panel).getByRole("combobox", { name: /^Variant/ }), "exercise");
    expect(within(panel).getByRole("status")).toHaveTextContent(/^π0:/);
  });
});

describe("Chapter 4 content", () => {
  const ch04 = (u: { unit: string }) => u.unit === "ch04";
  test("every section has a lesson whose maths renders, and the chapter is covered", () => {
    const lesson = bundle.lessons.find(ch04)!;
    expect(lesson.sections.map((s) => s.section)).toEqual(["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8"]);
    for (const s of lesson.sections) for (const l of s.layers) expect(texHasError(renderMarkdown(l.body)), `${s.id} ${l.layer}`).toBe(false);
    const { inventory, declarations } = loadCoverageInputs();
    const c = computeCoverage(bundle, inventory, declarations).find((x) => x.id === "4")!;
    expect(c.status).toBe("covered");
    expect(c.exercises.declared).toEqual({ "4.5": "lab-task", "4.9": "lab-task" });
    expect(c.exercises.missing).toEqual([]);
  });

  test("Example 4.2 is an item whose unexplained value-axis difference is flagged", () => {
    const ex = bundle.examples.find((x) => x.id === "ex.ch04.jacks-car-rental")!;
    expect(ex.bookLabel).toBe("Example 4.2");
    expect(ex.flags![0]).toMatchObject({ type: "replication-discrepancy" });
    expect(ex.flags![0].note).toMatch(/421\.4 to 637\.0/);
  });
});
