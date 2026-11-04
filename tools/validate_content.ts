// Validates content/ against the schema and runs every automated check it references.
// Usage: npm run validate (from app/). Exit code 1 on any problem.
import { loadBundle } from "./content_loader.ts";
import { validateBundle } from "../app/src/content/schema.ts";
import { CHECKS, checkIds } from "../app/src/content/checks.ts";
import { implementationIds } from "../app/src/lib/rl/registry.ts";

const bundle = loadBundle();
const errors = validateBundle(bundle, { checks: checkIds(), implementations: implementationIds() });

// Run the checks: facts must hold, and each numeric answer key must equal what its check computes.
for (const [id, c] of Object.entries(CHECKS)) if (c.kind === "fact" && !c.run()) errors.push(`check ${id}: claim not reproduced`);
for (const f of bundle.questionFiles)
  for (const q of f.questions) {
    if (!q.parts || q.verification?.method !== "computed" || !q.verification.check) continue;
    const c = CHECKS[q.verification.check];
    if (!c || c.kind !== "answer") {
      errors.push(`${q.id}: verification check ${q.verification.check} is not an answer check`);
      continue;
    }
    const got = c.run();
    if (got.length !== q.parts.length) errors.push(`${q.id}: check returns ${got.length} values for ${q.parts.length} parts`);
    q.parts.forEach((p, i) => {
      if (!(Math.abs(p.answer - got[i]) <= p.tolerance + 1e-12)) errors.push(`${q.id}: part "${p.label}" key ${p.answer} but check computes ${got[i]} (tolerance ${p.tolerance})`);
    });
  }

const n = (xs: unknown[]) => xs.length;
const qs = bundle.questionFiles.flatMap((f) => f.questions);
console.log(
  `content: ${n(bundle.concepts)} concepts, ${n(bundle.equations)} equations, ${n(bundle.algorithms)} algorithms, ${n(bundle.examples)} examples, ` +
    `${bundle.lessons.reduce((s, l) => s + l.sections.length, 0)} lesson sections, ${n(qs)} questions, ${n(bundle.notation)} notation entries; ${Object.keys(CHECKS).length} checks`,
);
if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log("content valid: every reference resolves, every page pair is consistent, every check passes.");
