// @vitest-environment jsdom
// Milestone 4F: Chapter 5 completed to the coverage criteria. Importance sampling (Examples 5.4–5.5), the corrected
// off-policy control algorithm of Figure 5.10, the racetrack of Exercise 5.9, the two new laboratory panels, and the
// Chapter 5 lessons, flags and coverage.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { preloadAll, renderApp } from "./helpers";
import { renderMarkdown, texHasError } from "../src/lib/render";
import { loadBundle, loadCoverageInputs } from "../../tools/content_loader.ts";
import { computeCoverage } from "../src/content/coverage";
import { makeRng } from "../src/domain/random";
import { INFINITE_VARIANCE_BEHAVIOUR, INFINITE_VARIANCE_TARGET, importanceRatio, infiniteVarianceMdp, isEstimates, newOffPolicyControl, offPolicyControlEpisode, weightedIncremental } from "../src/lib/rl/offPolicy";
import { TRACK_LEFT, TRACK_RIGHT, greedyTrajectory, racetrack } from "../src/lib/rl/envs/racetrack";

beforeAll(preloadAll);
afterEach(cleanup);
const settled = async () => {
  const h = await screen.findByRole("heading", { level: 1 });
  await waitFor(() => expect(document.activeElement).toBe(h));
  return h;
};
const bundle = loadBundle();

describe("importance sampling", () => {
  test("the ratio uses only the policies, and is 0 once the behaviour does what the target never would", () => {
    const target = [[1, 0], [0, 0]];
    const mu = [[0.5, 0.5], [0, 0]];
    expect(importanceRatio([{ t: 0, s: 0, a: 0, r: 0, next: 0 }, { t: 1, s: 0, a: 0, r: 1, next: 1 }], target, mu)).toBe(4);
    expect(importanceRatio([{ t: 0, s: 0, a: 1, r: 0, next: 1 }], target, mu)).toBe(0);
  });

  test("weighted importance sampling equals 1 in Example 5.5 once a consistent episode is seen; every-visit sees more visits", () => {
    const m = infiniteVarianceMdp();
    const first = isEstimates(m, INFINITE_VARIANCE_TARGET, INFINITE_VARIANCE_BEHAVIOUR, 0, 500, 1, makeRng(3));
    const k = Array.from(first.weighted).findIndex((x) => x !== 0);
    expect(Array.from(first.weighted.slice(k)).every((x) => Math.abs(x - 1) < 1e-12)).toBe(true);
    const every = isEstimates(m, INFINITE_VARIANCE_TARGET, INFINITE_VARIANCE_BEHAVIOUR, 0, 500, 1, makeRng(3), { everyVisit: true });
    expect(Array.from(every.weighted.slice(k)).every((x) => Math.abs(x - 1) < 1e-12)).toBe(true);
    expect(every.ordinary[499]).not.toBe(first.ordinary[499]);
  });

  test("the incremental weighted average ignores zero weights and matches the batch average", () => {
    expect(weightedIncremental([5, 1, -1], [0, 2, 6], 0)).toEqual([0, 0, 1, -0.5]);
  });
});

describe("the racetrack", () => {
  test("both tracks are proper finite MDPs with the draft's rewards", () => {
    for (const tr of [TRACK_LEFT, TRACK_RIGHT]) {
      const m = racetrack(tr);
      expect(m.starts).toHaveLength(tr.rows.at(-1)![1] - tr.rows.at(-1)![0] + 1);
      const problems: string[] = []; // collected, then asserted once (there are about 10⁵ transitions)
      for (let s = 1; s < m.states.length; s++)
        for (const outs of m.dynamics[s]) {
          if (Math.abs(outs.reduce((a, o) => a + o.prob, 0) - 1) > 1e-12) problems.push(`${s}: probabilities`);
          for (const o of outs) if (o.next < 0 || (o.reward !== -1 && o.reward !== -5)) problems.push(`${s}: ${o.next}, ${o.reward}`);
        }
      expect(problems).toEqual([]);
    }
    expect(TRACK_LEFT.rows).toHaveLength(32);
    expect(TRACK_RIGHT.rows).toHaveLength(30);
  });

  test("off-policy control (Figure 5.10, corrected) stops its backward pass at a non-greedy action", () => {
    const m = racetrack(TRACK_LEFT);
    const st = newOffPolicyControl(m);
    const rng = makeRng(8);
    let partial = 0;
    for (let e = 0; e < 300; e++) {
      const r = offPolicyControlEpisode(m, st, m.starts[0], 1, 0.3, rng);
      if (r.updated < r.length) partial++;
    }
    expect(partial).toBeGreaterThan(0); // some episodes stopped early: the correction is in effect
    expect(greedyTrajectory(m, st.pi, m.starts[0]).cells[0]).toEqual([31, 3]);
  });
});

describe("the Monte Carlo laboratory's new panels", () => {
  test("importance sampling on Example 5.4 shows measured and exact error; Example 5.5 shows the weighted estimate of 1", async () => {
    const user = userEvent.setup();
    renderApp("/lab/mc");
    await settled();
    const panel = screen.getByRole("heading", { name: /Off-policy prediction by importance sampling/ }).closest("section")!;
    const runs = within(panel).getByLabelText("Runs of importance sampling");
    await user.clear(runs);
    await user.type(runs, "5");
    const eps = within(panel).getByLabelText("Episodes per run");
    await user.clear(eps);
    await user.type(eps, "100");
    await user.click(within(panel).getByRole("button", { name: "Run" }));
    const table = within(panel).getByRole("table", { name: /exact error of ordinary IS/ });
    expect(within(table).getAllByRole("row").map((r) => r.querySelector("td")?.textContent).filter(Boolean)).toEqual(["1", "3", "10", "100"]);
    expect(within(table).getAllByRole("row")[3]).toHaveTextContent("1.016");
    await user.selectOptions(within(panel).getByLabelText(/^Example/), "loop");
    await user.click(within(panel).getByRole("button", { name: "Run" }));
    expect(within(panel).getByRole("table", { name: /Estimates after 100 episodes/ })).toHaveTextContent("1.000");
  });

  test("the racetrack learns and compares its expected returns with the optimum", async () => {
    const user = userEvent.setup();
    renderApp("/lab/mc");
    await settled();
    const panel = screen.getByRole("heading", { name: /Racetrack \(Exercise 5\.9/ }).closest("section")!;
    await user.click(within(panel).getByRole("button", { name: "+50,000 episodes" }));
    await within(panel).findByText("50000 episodes learned.", {}, { timeout: 20_000 });
    const table = await within(panel).findByRole("table", { name: /Expected return from each start cell/ });
    expect(within(table).getAllByRole("row")).toHaveLength(7); // header + 6 start cells
    expect(within(panel).getByRole("table", { name: /learned greedy trajectory/ })).toBeInTheDocument();
  });
});

describe("Chapter 5 content", () => {
  const ch05 = (u: { unit: string }) => u.unit === "ch05";
  test("every section has a lesson whose maths renders, and the chapter is covered", () => {
    const lesson = bundle.lessons.find(ch05)!;
    expect(lesson.sections.map((s) => s.section)).toEqual(["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9"]);
    for (const s of lesson.sections) for (const l of s.layers) expect(texHasError(renderMarkdown(l.body)), `${s.id} ${l.layer}`).toBe(false);
    const { inventory, declarations } = loadCoverageInputs();
    const c = computeCoverage(bundle, inventory, declarations).find((x) => x.id === "5")!;
    expect(c.status).toBe("covered");
    expect(c.exercises.declared).toEqual({ "5.9": "lab-task" });
    expect(c.exercises.missing).toEqual([]);
  });

  test("questionable source material is flagged, not corrected", () => {
    const concept = (id: string) => bundle.concepts.find((c) => c.id === id)!;
    expect(concept("ch05.off-policy-mc-control").flags![0].note).toMatch(/'if W = 0', which can never happen/);
    expect(concept("ch05.mc-action-values").flags![0].note).toMatch(/converge quadratically/);
  });
});
