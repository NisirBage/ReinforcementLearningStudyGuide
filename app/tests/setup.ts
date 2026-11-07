import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { configure } from "@testing-library/react";
import { allowed } from "./console";

// Pages and content load on demand (D-031). Under a full parallel run the first page that needs the maths
// renderer can take over a second to transform, so findBy/waitFor wait up to 10 s instead of the default 1 s.
// This is a ceiling on waiting, not a relaxed assertion: an element that never appears still fails the test.
// Raised from 5 s in Milestone 4A after first renders on a loaded machine took 5.7–6.2 s (the suite at the
// previous commit also ran 54–67 s that day, against 43 s before), failing a different UI test on 2 of 5 runs.
configure({ asyncUtilTimeout: 10_000 });

// Any React error or warning (bad effect cleanup, missing key, act misuse) fails the test that caused it.
let errors: string[] = [];
beforeEach(() => {
  errors = [];
  allowed.length = 0;
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const text = args.map(String).join(" ");
    if (!allowed.some((re) => re.test(text))) errors.push(text);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  if (errors.length) throw new Error(`console.error was called:\n${errors.join("\n").slice(0, 2000)}`);
});
