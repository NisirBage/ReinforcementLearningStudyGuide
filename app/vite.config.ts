import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { contentChunks } from "./plugins/vite_content.ts";

// Production-only Content-Security-Policy (from the NLP Study Lab). KaTeX positions glyphs with inline style
// attributes and React sets style attributes (progress bars), so attributes are allowed; inline scripts are not.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function cspMeta(): Plugin {
  return {
    name: "csp-meta",
    apply: "build",
    transformIndexHtml: (html) => html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

function fill(template: string, values: Record<string, string>): string {
  for (const [key, value] of Object.entries(values)) {
    if (template.split(key).length !== 2) throw new Error(`sw.template.js must contain ${key} exactly once`);
    template = template.replace(key, value);
  }
  return template;
}

// Emits sw.js with two file lists (Milestone 3A, D-032):
//   PRECACHE  stored at install: the app shell, the code of every page, the maths renderer and its woff2 fonts.
//   ALL       every built file. Content chunks (one per unit, the notation) and other font formats are stored the
//             first time they are fetched, or all at once from Settings → Save for offline.
// So opening the dashboard does not download every chapter, yet any page opened once keeps working offline.
const isContentChunk = (item: { type: string; facadeModuleId?: string | null }) =>
  item.type === "chunk" && /^\0virtual:rl-(unit\/|notation)/.test(item.facadeModuleId ?? "");
const isOptionalFont = (name: string) => /\.(ttf|woff)$/.test(name);

function serviceWorker(): Plugin {
  const template = readFileSync(fileURLToPath(new URL("./src/sw.template.js", import.meta.url)), "utf-8");
  return {
    name: "precache-sw",
    apply: "build",
    generateBundle(_options, bundle) {
      const publicDir = fileURLToPath(new URL("./public", import.meta.url));
      const publicFiles = readdirSync(publicDir, { recursive: true, withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => relative(publicDir, join(d.parentPath, d.name)).split(sep).join("/"));
      const all = ["./", ...[...Object.keys(bundle), ...publicFiles].map((f) => "./" + f)].sort();
      const later = new Set(Object.entries(bundle).filter(([name, item]) => isContentChunk(item as never) || isOptionalFont(name)).map(([name]) => "./" + name));
      const precache = all.filter((f) => !later.has(f));
      const h = createHash("sha256").update(template);
      for (const [name, item] of Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))) h.update(name).update(item.type === "chunk" ? item.code : item.source);
      for (const f of publicFiles.sort()) h.update(f).update(readFileSync(join(publicDir, f)));
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: fill(template, { __PRECACHE__: JSON.stringify(precache), __ALL__: JSON.stringify(all), __VERSION__: h.digest("hex").slice(0, 12) }),
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [contentChunks(), react(), cspMeta(), serviceWorker()],
  // Bind to this machine only (NLP Study Lab D-007).
  server: { host: "localhost", port: 5174, strictPort: true, fs: { allow: [".."] } },
  preview: { host: "localhost", port: 4174, strictPort: true },
  // Never inline assets as data: URIs (KaTeX fonts would then be blocked by font-src 'self').
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    assetsInlineLimit: 0,
    // The maths renderer is the largest chunk; it is fetched only by pages that show maths.
    chunkSizeWarningLimit: 450,
    rollupOptions: {
      output: {
        manualChunks: (id) => (/node_modules[\/](katex|markdown-it|mdurl|uc\.micro|linkify-it|punycode|entities)[\/]/.test(id) || /src[\/]lib[\/]render\.ts$/.test(id) ? "render" : undefined),
      },
    },
  },
});
