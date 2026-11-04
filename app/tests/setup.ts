import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";

// Any React error or warning (bad effect cleanup, missing key, act misuse) fails the test that caused it.
let errors: string[] = [];
beforeEach(() => {
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  if (errors.length) throw new Error(`console.error was called:\n${errors.join("\n").slice(0, 2000)}`);
});
