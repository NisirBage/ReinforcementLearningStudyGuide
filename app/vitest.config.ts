// Test configuration (kept apart from vite.config.ts). Pure-logic tests run in Node; UI tests opt into jsdom
// with a `// @vitest-environment jsdom` comment.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { contentChunks } from "./plugins/vite_content.ts";

export default defineConfig({
  plugins: [contentChunks(), react()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30_000,
    // Setup hooks (beforeAll(preloadAll): every route, the whole content bundle and the search index, built through
    // Vite) get the same limit as tests. Their work grows with the content, and with 27 files in parallel it passed
    // 10 s under load (Milestones 4C and 4E) while finishing in a few seconds alone. No assertion depends on this.
    // Since Milestone 4K, tests/checks.test.ts (every content check, about 45 s of CPU) runs on its own after the
    // other files (see the "test" and "check" scripts), so it no longer competes with the UI tests.
    hookTimeout: 30_000,
  },
});
