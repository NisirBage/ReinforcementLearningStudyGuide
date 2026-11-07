// Vite plugin (used by vite.config.ts and vitest.config.ts): serves the content as a small catalogue plus one lazily loaded chunk per unit (D-031).
//
//   import { catalog, loadUnit, loadNotation } from "virtual:rl-content";
//
// The catalogue is computed from content/ with the same pure functions the tests use (app/src/content/catalog.ts),
// so the browser never holds a second hand-maintained copy. Each unit becomes its own dynamic import, and Rollup
// emits it as a separate file. Local-only provenance keys ("file", "$comment") are dropped from everything served.
import { resolve } from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { CONTENT_DIR, loadBundle, loadCoverageInputs } from "../../tools/content_loader.ts";
import { computeCoverage, coverageSummary } from "../src/content/coverage.ts";
import { buildCatalog, unitContent } from "../src/content/catalog.ts";
import { buildSearchDocs } from "../src/content/searchDocs.ts";

const ID = "virtual:rl-content";
const UNIT = "virtual:rl-unit/";
const NOTATION = "virtual:rl-notation";
const SEARCH = "virtual:rl-search"; // the search documents, built here so search never loads chapter bodies (D-042)
const resolved = (id: string) => "\0" + id;

const LOCAL_ONLY_KEYS = new Set(["file", "$comment"]);
export const stripLocal = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(stripLocal)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.entries(v).filter(([k]) => !LOCAL_ONLY_KEYS.has(k)).map(([k, x]) => [k, stripLocal(x)]))
      : v;

// JSON.parse of a string literal is faster to start than an equivalent object literal, and keeps the chunk plain data.
const asModule = (value: unknown) => `export default JSON.parse(${JSON.stringify(JSON.stringify(stripLocal(value)))});\n`;

export function contentChunks(): Plugin {
  let bundle = loadBundle();
  const reload = () => (bundle = loadBundle());
  return {
    name: "rl-content",
    enforce: "pre",
    resolveId(id) {
      if (id === ID || id === NOTATION || id === SEARCH || id.startsWith(UNIT)) return resolved(id);
    },
    load(id) {
      if (!id.startsWith("\0")) return;
      const key = id.slice(1);
      if (key === ID) {
        const { inventory, declarations } = loadCoverageInputs();
        const catalog = buildCatalog(bundle, coverageSummary(computeCoverage(bundle, inventory, declarations)));
        const loaders = catalog.contentUnits.map((u) => `  ${JSON.stringify(u)}: () => import(${JSON.stringify(UNIT + u)}),`).join("\n");
        return [
          `export const catalog = JSON.parse(${JSON.stringify(JSON.stringify(stripLocal(catalog)))});`,
          `const units = {\n${loaders}\n};`,
          `/** Resolves to the unit's content, or null for a unit with no content files. */`,
          `export const loadUnit = (unit) => (units[unit] ? units[unit]().then((m) => m.default) : Promise.resolve(null));`,
          `export const loadNotation = () => import(${JSON.stringify(NOTATION)}).then((m) => m.default);`,
          "",
        ].join("\n");
      }
      if (key === NOTATION) return asModule(bundle.notation);
      if (key === SEARCH) return asModule(buildSearchDocs(bundle));
      if (key.startsWith(UNIT)) return asModule(unitContent(bundle, key.slice(UNIT.length)));
    },
    configureServer(server: ViteDevServer) {
      // Editing content in dev reloads the page with the new catalogue and units.
      server.watcher.add(CONTENT_DIR);
      server.watcher.on("change", (file) => {
        if (!resolve(file).toLowerCase().startsWith(resolve(CONTENT_DIR).toLowerCase()) || !file.endsWith(".json")) return;
        reload();
        for (const m of server.moduleGraph.idToModuleMap.values()) if (m.id?.startsWith("\0virtual:rl-")) server.moduleGraph.invalidateModule(m);
        server.ws.send({ type: "full-reload" });
      });
    },
  };
}
