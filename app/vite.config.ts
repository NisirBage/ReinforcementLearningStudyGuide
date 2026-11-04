import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

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

// Emits sw.js listing every built file, so the whole app works offline after the first visit.
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
      const files = ["./", ...[...Object.keys(bundle), ...publicFiles].map((f) => "./" + f)].sort();
      const h = createHash("sha256").update(template);
      for (const [name, item] of Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))) h.update(name).update(item.type === "chunk" ? item.code : item.source);
      for (const f of publicFiles.sort()) h.update(f).update(readFileSync(join(publicDir, f)));
      this.emitFile({ type: "asset", fileName: "sw.js", source: fill(template, { __PRECACHE__: JSON.stringify(files), __VERSION__: h.digest("hex").slice(0, 12) }) });
    },
  };
}

// Source PDF file names are local provenance; the app never needs them, so they are dropped from bundled content.
const LOCAL_ONLY_KEYS = new Set(["file", "$comment"]);
function stripLocalProvenance(): Plugin {
  const contentDir = fileURLToPath(new URL("../content/", import.meta.url));
  const strip = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(strip)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v).filter(([k]) => !LOCAL_ONLY_KEYS.has(k)).map(([k, x]) => [k, strip(x)]))
        : v;
  return {
    name: "strip-local-provenance",
    enforce: "pre",
    transform(code, id) {
      const file = id.split("?")[0];
      if (!file.endsWith(".json") || !resolve(file).toLowerCase().startsWith(resolve(contentDir).toLowerCase())) return;
      return { code: JSON.stringify(strip(JSON.parse(code))), map: null };
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [stripLocalProvenance(), react(), cspMeta(), serviceWorker()],
  // Bind to this machine only (NLP Study Lab D-007).
  server: { host: "localhost", port: 5174, strictPort: true, fs: { allow: [".."] } },
  preview: { host: "localhost", port: 4174, strictPort: true },
  // Never inline assets as data: URIs (KaTeX fonts would then be blocked by font-src 'self').
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false, assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
});
