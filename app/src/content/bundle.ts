// The content bundle in the browser: the same files tools/content_loader.ts reads in Node, bundled by Vite.
import sources from "../../../content/source/sources.json";
import curriculum from "../../../content/curriculum/curriculum.json";
import notation from "../../../content/notation/notation.json";
import type { ContentBundle } from "./schema";
import { buildIndexes } from "./indexes";
import { buildSearchDocs } from "./searchDocs";
import { buildIndex } from "../domain/search";

const sorted = <T,>(mods: Record<string, T>): T[] => Object.keys(mods).sort().map((k) => mods[k]);
const glob = {
  concepts: import.meta.glob("../../../content/concepts/*.json", { eager: true, import: "default" }),
  equations: import.meta.glob("../../../content/equations/*.json", { eager: true, import: "default" }),
  algorithms: import.meta.glob("../../../content/algorithms/*.json", { eager: true, import: "default" }),
  examples: import.meta.glob("../../../content/examples/*.json", { eager: true, import: "default" }),
  figures: import.meta.glob("../../../content/figures/*.json", { eager: true, import: "default" }),
  labs: import.meta.glob("../../../content/labs/*.json", { eager: true, import: "default" }),
  lessons: import.meta.glob("../../../content/lessons/*.json", { eager: true, import: "default" }),
  questions: import.meta.glob("../../../content/questions/*.json", { eager: true, import: "default" }),
};

export const bundle: ContentBundle = {
  sources: sources as unknown as ContentBundle["sources"],
  curriculum: curriculum as unknown as ContentBundle["curriculum"],
  notation: notation as unknown as ContentBundle["notation"],
  concepts: sorted(glob.concepts).flat() as ContentBundle["concepts"],
  equations: sorted(glob.equations).flat() as ContentBundle["equations"],
  algorithms: sorted(glob.algorithms).flat() as ContentBundle["algorithms"],
  examples: sorted(glob.examples).flat() as ContentBundle["examples"],
  figures: sorted(glob.figures).flat() as ContentBundle["figures"],
  labs: sorted(glob.labs).flat() as ContentBundle["labs"],
  lessons: sorted(glob.lessons) as ContentBundle["lessons"],
  questionFiles: sorted(glob.questions) as ContentBundle["questionFiles"],
};

export const idx = buildIndexes(bundle);
let searchIndex: ReturnType<typeof buildIndex> | null = null;
/** Built on first use, so pages that never search do not pay for it. */
export const getSearchIndex = () => (searchIndex ??= buildIndex(buildSearchDocs(bundle)));
