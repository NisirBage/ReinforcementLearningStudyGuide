// Fails if the production build (app/dist) contains anything that must never be published (from the NLP Study Lab):
// local machine paths, source PDF names, extracted-text folders or source maps. Run after `vite build` (from app/).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../app/dist/", import.meta.url));
const PATTERNS: [string, RegExp][] = [
  ["Windows user path", /[A-Za-z]:\\{1,2}Users\\{1,2}/],
  ["POSIX home path", /\/(?:home|Users)\/[A-Za-z0-9_.-]+\//],
  ["Desktop folder", /Desktop[\\/]Academic/i],
  ["textbook file name", /SuttonBarto|IPRLBook/i],
  ["Zhao chapter file name", /\d - Chapter \d+ /],
  ["extracted-text folder", /_extracted/],
  ["PDF file reference", /\.pdf["'`]/i],
];
const files = readdirSync(dist, { recursive: true, withFileTypes: true }).filter((d) => d.isFile());
const problems: string[] = [];
for (const d of files) {
  const path = join(d.parentPath, d.name);
  const rel = path.slice(dist.length);
  if (rel.endsWith(".map")) problems.push(`${rel}: source map in build`);
  if (/\.(pdf|txt|env)$/i.test(rel)) problems.push(`${rel}: forbidden file type`);
  if (!/\.(js|html|css|json|webmanifest|svg)$/.test(rel)) continue;
  const text = readFileSync(path, "utf-8");
  for (const [label, re] of PATTERNS) {
    const m = re.exec(text);
    if (m) problems.push(`${rel}: ${label} (…${text.slice(Math.max(0, m.index - 20), m.index + 30)}…)`);
  }
}
if (problems.length) {
  console.error(`Build privacy check FAILED (${problems.length}):\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log(`Build privacy check passed: ${files.length} files in app/dist, no local paths, source names or source maps.`);
