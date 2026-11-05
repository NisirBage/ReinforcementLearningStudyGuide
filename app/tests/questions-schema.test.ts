// Milestone 3A question format: provenance, section mapping, rubrics, option notes, related questions,
// and the exercise registry the provenance rules are checked against. Each rule is shown to reject broken content.
import { describe, expect, test } from "vitest";
import { loadBundle } from "../../tools/content_loader.ts";
import { validateBundle, type ContentBundle, type Question } from "../src/content/schema";
import { checkIds } from "../src/content/checks";
import { implementationIds } from "../src/lib/rl/registry";

const ctx = { checks: checkIds(), implementations: implementationIds() };
const real = loadBundle();
const all = (b: ContentBundle) => b.questionFiles.flatMap((f) => f.questions);
const q = (b: ContentBundle, id: string) => all(b).find((x) => x.id === id)!;
const errorsAfter = (mutate: (b: ContentBundle) => void) => {
  const b = structuredClone(real);
  mutate(b);
  return validateBundle(b, ctx);
};
const expectError = (pattern: RegExp, mutate: (b: ContentBundle) => void) => {
  const errs = errorsAfter(mutate);
  expect(errs.some((e) => pattern.test(e)), `expected ${pattern} in:\n${errs.join("\n")}`).toBe(true);
};

describe("exercise registry (from the April 2015 draft)", () => {
  const ex = real.sources.sb.exercises;
  test("lists every exercise heading with page numbers", () => {
    expect(ex.length).toBe(85);
    expect(ex.find((e) => e.id === "4.1")).toEqual({ id: "4.1", chapter: "4", page: 110, pdfPage: 124, optional: false, programming: false, placeholder: false });
    for (const e of ex) expect(e.pdfPage).toBe(e.page + 14);
  });
  test("records the draft's two placeholder numbers", () => {
    expect(ex.filter((e) => e.placeholder).map((e) => e.id)).toEqual(["3.7", "8.1"]);
  });
  test("records optional and programming markers", () => {
    expect(ex.filter((e) => e.optional).map((e) => e.id)).toEqual(["5.10", "7.3", "11.1"]);
    expect(ex.filter((e) => e.programming).map((e) => e.id)).toEqual(["2.4", "4.5", "4.9", "5.9", "7.5", "8.4", "8.7"]);
  });
  test("numbers run consecutively within each chapter", () => {
    const by = new Map<string, number[]>();
    for (const e of ex) by.set(e.chapter, [...(by.get(e.chapter) ?? []), Number(e.id.split(".")[1])]);
    for (const ns of by.values()) expect(ns).toEqual(ns.map((_, i) => i + 1));
  });
  test("a broken registry entry is rejected", () => {
    expect(errorsAfter((b) => (b.sources.sb.exercises[0].pdfPage += 1)).some((e) => /pdfPage must be page \+ 14/.test(e))).toBe(true);
  });
});

describe("every real question", () => {
  test("has provenance and a section mapping", () => {
    for (const x of all(real)) {
      expect(x.provenance, x.id).toBeDefined();
      expect(x.section === null || typeof x.section === "string", x.id).toBe(true);
    }
  });
  test("the four provenance kinds are kept apart", () => {
    const kinds = Object.fromEntries(all(real).map((x) => [x.id, x.provenance.kind]));
    expect(kinds["ch04-q001"]).toBe("textbook-exercise");
    expect(kinds["ch02-q004"]).toBe("generated");
    expect(kinds["ch02-q001"]).toBe("textbook-derived");
    expect(kinds["sup-zhao-06-q001"]).toBe("supplementary");
    for (const x of all(real)) expect(x.provenance.kind === "supplementary", x.id).toBe(x.unit.startsWith("sup-"));
  });
});

describe("validator rejects", () => {
  test("a question with no provenance", () =>
    expectError(/provenance needs a kind/, (b) => {
      delete (q(b, "ch02-q001") as Partial<Question>).provenance;
    }));
  test("the retired adaptedFrom field", () =>
    expectError(/adaptedFrom was replaced/, (b) => {
      (q(b, "ch04-q001") as Question & { adaptedFrom: string }).adaptedFrom = "Exercise 4.1";
    }));
  test("a core question labelled supplementary", () =>
    expectError(/exactly when the unit is supplementary/, (b) => {
      q(b, "ch02-q001").provenance = { kind: "supplementary" };
    }));
  test("a supplementary question labelled as a textbook exercise", () =>
    expectError(/exactly when the unit is supplementary/, (b) => {
      q(b, "sup-zhao-06-q001").provenance = { kind: "textbook-exercise", exercise: "4.1" };
    }));
  test("an exercise the draft does not have", () =>
    expectError(/Exercise 4\.99 is not an exercise/, (b) => {
      q(b, "ch04-q001").provenance = { kind: "textbook-exercise", exercise: "4.99" };
    }));
  test("claiming one of the draft's placeholder exercises", () =>
    expectError(/placeholder in the draft/, (b) => {
      q(b, "ch04-q001").provenance = { kind: "textbook-derived", basis: ["Exercise 3.7"] };
    }));
  test("an exercise from another chapter", () =>
    expectError(/belongs to another chapter/, (b) => {
      const x = q(b, "ch04-q001");
      x.provenance = { kind: "textbook-exercise", exercise: "3.8" };
      x.sources = [{ kind: "textbook", chapter: "3", printedPages: [86, 86], pdfPages: [100, 100] }];
    }));
  test("an exercise question that does not cite the exercise's page", () =>
    expectError(/must cite the page of Exercise 4\.1/, (b) => {
      q(b, "ch04-q001").sources = [{ kind: "textbook", chapter: "4", section: "4.1", printedPages: [91, 91], pdfPages: [105, 105] }];
    }));
  test("a derived question with no basis", () =>
    expectError(/needs at least one basis/, (b) => {
      q(b, "ch02-q001").provenance = { kind: "textbook-derived", basis: [] };
    }));
  test("a basis that names nothing real", () =>
    expectError(/basis eq\.ch02\.nope is not/, (b) => {
      q(b, "ch02-q001").provenance = { kind: "textbook-derived", basis: ["eq.ch02.nope"] };
    }));
  test("a core question based on a supplementary item", () =>
    expectError(/other side of the core\/supplementary line/, (b) => {
      q(b, "ch02-q001").provenance = { kind: "textbook-derived", basis: ["eq.sup-zhao-06.rm-update"] };
    }));
  test("a section outside the unit's chapter", () =>
    expectError(/section must be null or a textbook section of this unit's chapter/, (b) => {
      q(b, "ch02-q001").section = "4.1";
    }));
  test("a section that does not exist", () =>
    expectError(/section must be null/, (b) => {
      q(b, "ch02-q001").section = "2.99";
    }));
  test("a reviewed multi question without notes on each option", () =>
    expectError(/one optionNote per option/, (b) => {
      q(b, "ch02-q005").optionNotes!.pop();
    }));
  test("option notes on a numeric question", () =>
    expectError(/optionNotes are only for mcq and multi/, (b) => {
      q(b, "ch02-q002").optionNotes = ["x"];
    }));
  test("a short answer with no rubric", () =>
    expectError(/needs a rubric/, (b) => {
      const x = q(b, "ch02-q007");
      Object.assign(x, { type: "short-answer", answer: "Model answer." });
    }));
  test("a rubric that does not add up to the marks", () =>
    expectError(/rubric marks must add up/, (b) => {
      const x = q(b, "ch02-q007");
      Object.assign(x, { type: "short-answer", answer: "Model answer.", marks: 3, rubric: [{ point: "a", marks: 1 }, { point: "b", marks: 1 }] });
    }));
  test("a rubric on an auto-graded question", () =>
    expectError(/rubric is only for/, (b) => {
      q(b, "ch02-q002").rubric = [{ point: "a", marks: 2 }];
    }));
  test("a related question that does not exist", () =>
    expectError(/related names unknown question ch02-q999/, (b) => {
      q(b, "ch02-q001").related = ["ch02-q999"];
    }));
  test("a related question across the core/supplementary line", () =>
    expectError(/related question sup-zhao-06-q001 is on the other side/, (b) => {
      q(b, "ch02-q001").related = ["sup-zhao-06-q001"];
    }));
});

describe("validator accepts", () => {
  test("a well-formed short answer with a rubric", () => {
    const errs = errorsAfter((b) => {
      Object.assign(q(b, "ch02-q007"), { type: "short-answer", answer: "Model answer.", marks: 2, rubric: [{ point: "a", marks: 1 }, { point: "b", marks: 1 }] });
    });
    expect(errs).toEqual([]);
  });
});
