import { describe, expect, test } from "vitest";
import {
  ACTIVITY_CAP, DAY, accuracyOf, completion, dueCards, emptyProgress, logActivity, newCard, recordAttempt, review, reviewCard,
  setConceptStatus, statusOf, toggleMarked, visit, weakest, type Attempt,
} from "../src/domain/progress";

const att = (qid: string, unit: string, concepts: string[], score: number, max: number, at: number): Attempt => ({ qid, unit, concepts, score, max, at });

describe("concept status", () => {
  test("defaults to not-started, records the five states, and clearing removes the record", () => {
    let p = emptyProgress();
    expect(statusOf(p, "ch02.ucb")).toBe("not-started");
    for (const s of ["learning", "understood", "needs-revision", "mastered"] as const) {
      p = setConceptStatus(p, "ch02.ucb", s, 1);
      expect(statusOf(p, "ch02.ucb")).toBe(s);
    }
    p = setConceptStatus(p, "ch02.ucb", "not-started", 2);
    expect(p.conceptStatus).toEqual({});
    expect(p.activity[0]).toMatchObject({ kind: "status", ref: "ch02.ucb", detail: "not-started" });
  });
  test("completion counts understood and mastered only", () => {
    let p = emptyProgress();
    p = setConceptStatus(p, "a.x", "understood", 1);
    p = setConceptStatus(p, "a.y", "mastered", 1);
    p = setConceptStatus(p, "a.z", "learning", 1);
    expect(completion(p, ["a.x", "a.y", "a.z", "a.w"])).toBe(0.5);
    expect(completion(p, [])).toBe(0);
  });
});

describe("attempts and analytics", () => {
  test("recordAttempt rejects impossible scores and never mutates its input", () => {
    const p0 = emptyProgress();
    const p1 = recordAttempt(p0, att("ch02-q001", "ch02", ["ch02.incremental-update"], 2, 3, 5));
    expect(p0.attempts).toEqual([]);
    expect(p1.attempts).toHaveLength(1);
    expect(() => recordAttempt(p0, att("x", "ch02", [], 4, 3, 1))).toThrow();
    expect(() => recordAttempt(p0, att("x", "ch02", [], 1, 0, 1))).toThrow();
  });
  test("accuracy is score over marks across attempts", () => {
    const a = accuracyOf([att("q1", "ch02", [], 1, 2, 1), att("q1", "ch02", [], 2, 2, 2), att("q2", "ch04", [], 0, 4, 3)]);
    expect(a).toEqual({ attempted: 2, attempts: 3, score: 3, max: 8, accuracy: 3 / 8 });
    expect(accuracyOf([]).accuracy).toBeNull();
  });
  test("weakest units and concepts, ignoring thin evidence", () => {
    const list = [
      ...[1, 2, 3].map((i) => att(`a${i}`, "ch02", ["ch02.ucb"], 0, 1, i)),
      ...[1, 2, 3].map((i) => att(`b${i}`, "ch04", ["ch04.policy-evaluation"], 1, 1, i)),
      att("c1", "ch03", ["ch03.return"], 0, 1, 9),
    ];
    expect(weakest(list, "unit").map((g) => g.key)).toEqual(["ch02", "ch04"]); // ch03 has 1 attempt < 3
    expect(weakest(list, "concept")[0].key).toBe("ch02.ucb");
  });
  test("marked questions stay sorted and unique", () => {
    let p = toggleMarked(emptyProgress(), "ch04-q002");
    p = toggleMarked(p, "ch02-q001");
    expect(p.marked).toEqual(["ch02-q001", "ch04-q002"]);
    expect(toggleMarked(p, "ch02-q001").marked).toEqual(["ch04-q002"]);
  });
  test("activity log is newest first and capped", () => {
    let p = emptyProgress();
    for (let i = 0; i < ACTIVITY_CAP + 20; i++) p = logActivity(p, { at: i, kind: "lesson", ref: `u${i}` });
    expect(p.activity).toHaveLength(ACTIVITY_CAP);
    expect(p.activity[0].at).toBe(ACTIVITY_CAP + 19);
  });
  test("visit records the last place for 'continue learning'", () => {
    expect(visit(emptyProgress(), "/learn/ch02", "Multi-arm Bandits", 7).lastVisited).toEqual({ path: "/learn/ch02", title: "Multi-arm Bandits", at: 7 });
  });
});

describe("spaced repetition (SM-2 family)", () => {
  const t0 = 1_000_000;
  test("good answers schedule 1 day, 6 days, then interval × ease", () => {
    let c = newCard(t0);
    c = reviewCard(c, 2, t0);
    expect([c.reps, c.interval, c.due]).toEqual([1, 1, t0 + DAY]);
    c = reviewCard(c, 2, t0 + DAY);
    expect(c.interval).toBe(6);
    const ease = c.ease;
    c = reviewCard(c, 2, t0 + 7 * DAY);
    expect(c.interval).toBe(Math.round(6 * ease));
    expect(c.last).toBe(t0 + 7 * DAY);
  });
  test("a lapse resets the streak, counts the lapse, comes back tomorrow", () => {
    let c = reviewCard(reviewCard(newCard(t0), 2, t0), 2, t0 + DAY);
    c = reviewCard(c, 0, t0 + 2 * DAY);
    expect([c.reps, c.interval, c.lapses, c.due]).toEqual([0, 1, 1, t0 + 3 * DAY]);
  });
  test("ease never drops below 1.3", () => {
    let c = newCard(t0);
    for (let i = 0; i < 20; i++) c = reviewCard(c, 0, t0 + i * DAY);
    expect(c.ease).toBe(1.3);
  });
  test("easy stretches and hard shrinks the interval", () => {
    const base = reviewCard(reviewCard(newCard(t0), 2, t0), 2, t0);
    expect(reviewCard(base, 3, t0).interval).toBeGreaterThan(reviewCard(base, 2, t0).interval);
    expect(reviewCard(base, 1, t0).interval).toBeLessThan(reviewCard(base, 2, t0).interval);
  });
  test("dueCards lists overdue cards first and leaves future ones out", () => {
    let p = review(emptyProgress(), "card-a", 2, t0); // due t0 + 1 day
    p = review(p, "card-b", 0, t0 - DAY); // due t0
    p = review(review(p, "card-c", 2, t0), "card-c", 2, t0); // second good review: due in 6 days
    expect(dueCards(p, t0 + DAY)).toEqual(["card-b", "card-a"]);
    expect(dueCards(p, t0 - 1)).toEqual([]);
  });
});
