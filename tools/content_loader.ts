// Loads everything under content/ from disk (Node). The browser build loads the same files through Vite.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ContentBundle } from "../app/src/content/schema.ts";

export const CONTENT_DIR = resolve(import.meta.dirname, "..", "content");

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf-8"));

/** JSON files of a content folder, sorted by name, with their file names (for error messages). */
export function jsonFiles(dir: string): { file: string; data: unknown }[] {
  const full = join(CONTENT_DIR, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ file: `${dir}/${f}`, data: readJson(join(full, f)) }));
}

export function loadBundle(): ContentBundle {
  const flat = <T>(dir: string): T[] => jsonFiles(dir).flatMap((f) => f.data as T[]);
  return {
    sources: readJson(join(CONTENT_DIR, "source", "sources.json")) as ContentBundle["sources"],
    curriculum: readJson(join(CONTENT_DIR, "curriculum", "curriculum.json")) as ContentBundle["curriculum"],
    notation: readJson(join(CONTENT_DIR, "notation", "notation.json")) as ContentBundle["notation"],
    concepts: flat("concepts"),
    equations: flat("equations"),
    algorithms: flat("algorithms"),
    examples: flat("examples"),
    lessons: jsonFiles("lessons").map((f) => f.data as ContentBundle["lessons"][number]),
    questionFiles: jsonFiles("questions").map((f) => f.data as ContentBundle["questionFiles"][number]),
  };
}
