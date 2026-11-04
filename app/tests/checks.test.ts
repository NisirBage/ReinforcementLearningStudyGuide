// Every automated check passes, and every numeric answer key equals what its check computes.
import { describe, expect, test } from "vitest";
import { loadBundle } from "../../tools/content_loader.ts";
import { CHECKS, FIG_4_2, roundHalfTowardZero1 } from "../src/content/checks";

const bundle = loadBundle();

describe("fact checks (claims of the source reproduced by our code)", () => {
  for (const [id, c] of Object.entries(CHECKS))
    if (c.kind === "fact")
      test(id, () => {
        expect(c.run()).toBe(true);
      });
});

describe("numeric answer keys", () => {
  for (const f of bundle.questionFiles)
    for (const q of f.questions)
      if (q.parts)
        test(q.id, () => {
          const c = CHECKS[q.verification!.check!];
          expect(c.kind).toBe("answer");
          const got = (c as { run: () => number[] }).run();
          expect(got).toHaveLength(q.parts!.length);
          q.parts!.forEach((p, i) => expect(Math.abs(p.answer - got[i])).toBeLessThanOrEqual(p.tolerance + 1e-12));
        });
});

describe("Figure 4.2 transcription", () => {
  test("has 16 cells per grid with both terminal corners 0", () => {
    for (const g of Object.values(FIG_4_2)) {
      expect(g).toHaveLength(16);
      expect([g[0], g[15]]).toEqual([0, 0]);
    }
  });
  test("is symmetric under the 180° rotation of the grid, as the problem is", () => {
    for (const g of Object.values(FIG_4_2)) expect(g.map((_, i) => g[15 - i])).toEqual(g);
  });
  test("roundHalfTowardZero1", () => {
    expect([-1.75, -2.875, -8.3524, -2.4375, 1.75, 0.04].map(roundHalfTowardZero1)).toEqual([-1.7, -2.9, -8.4, -2.4, 1.7, 0]);
  });
});
