// The app's own source code for an implementation key (e.g. "td.qLearningStep"), so an explainer shows the exact
// function that runs in the labs and is tested against the book. The files are loaded on demand as raw text.
const FILES = import.meta.glob("./rl/**/*.ts", { query: "?raw", import: "default" }) as Record<string, () => Promise<string>>;

const ENV_FILE: Record<string, string> = { recyclingRobot: "envs/recycling", gridworld4x4: "envs/gridworld4x4" };

/** The file, relative to lib/, that defines an implementation key. */
export function sourceFileFor(key: string): string {
  const [mod, name] = key.split(".");
  const file = mod === "envs" ? (ENV_FILE[name] ?? "envs/examples") : mod;
  return `rl/${file}.ts`;
}

/**
 * The text of one top-level exported function, with the comment block directly above it. Relies on the
 * formatter's layout: the function starts at column 0 with `export function name` and ends at the next line
 * that is exactly "}".
 */
export function extractFunction(src: string, name: string): string | null {
  const lines = src.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^export (async )?function ${name}\\b`).test(l));
  if (start < 0) return null;
  let end = start;
  while (end < lines.length && lines[end] !== "}") end++;
  if (end === lines.length) return null;
  let top = start;
  while (top > 0 && /^\s*(\/\/|\/\*\*|\*)/.test(lines[top - 1])) top--;
  return lines.slice(top, end + 1).join("\n");
}

export async function loadImplementation(key: string): Promise<{ file: string; code: string } | null> {
  const file = sourceFileFor(key);
  const load = FILES[`./${file}`];
  if (!load) return null;
  const code = extractFunction(await load(), key.split(".")[1]);
  return code ? { file: `src/lib/${file}`, code } : null;
}
