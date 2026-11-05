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
  },
});
