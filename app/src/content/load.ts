// Browser access to content: the catalogue is available at once; full content is fetched per unit on demand.
// Pages call useContent(units), which suspends until those units are loaded (a <Suspense> boundary shows the
// loading state) and throws if a chunk cannot be fetched (an error boundary offers a retry).
import { use } from "react";
import { catalog, loadNotation, loadUnit } from "virtual:rl-content";
import { bundleFrom, emptyUnit, type UnitContent } from "./catalog";
import { buildIndexes, catalogIndex, type Indexes } from "./indexes";
import type { buildIndex } from "../domain/search";
import type { NotationEntry } from "./schema";

/** Lookups over the catalogue: navigation, counts, titles, cross-links. Never full content. */
export const cat = catalogIndex(catalog);

const unitCache = new Map<string, Promise<UnitContent>>();
const indexCache = new Map<string, Promise<Indexes>>();
let notationCache: Promise<NotationEntry[]> | null = null;

/**
 * Marks a promise with its outcome the way React's use() reads it, so content that is already loaded renders
 * at once instead of flashing the loading state for a frame.
 */
export function tracked<T>(p: Promise<T>): Promise<T> {
  const t = p as Promise<T> & { status?: string; value?: T; reason?: unknown };
  t.status = "pending";
  // Block bodies: returning the promise itself from its own handler would re-raise the failure as unhandled.
  p.then(
    (value) => {
      Object.assign(t, { status: "fulfilled", value });
    },
    (reason) => {
      Object.assign(t, { status: "rejected", reason });
    },
  );
  return p;
}

type Tracked<T> = Promise<T> & { status?: string; value?: T };
const isDone = <T,>(p: Promise<T> | null | undefined): p is Tracked<T> => (p as Tracked<T> | undefined)?.status === "fulfilled";
/** An already-fulfilled promise that use() reads synchronously. */
function settled<T>(value: T): Promise<T> {
  return Object.assign(Promise.resolve(value), { status: "fulfilled", value });
}

/**
 * A failed download stays cached (so React sees the failure instead of starting the download again on every
 * render) until the learner presses "Try again", which calls retryFailed().
 */
const retryHooks = new Set<() => void>();
export const onRetry = (f: () => void) => void retryHooks.add(f);
export const retryFailed = () => retryHooks.forEach((f) => f());
const isFailed = (p: unknown) => (p as { status?: string } | null)?.status === "rejected";

function remember<T>(cache: Map<string, Promise<T>>, key: string, make: () => Promise<T>): Promise<T> {
  let p = cache.get(key);
  if (!p) {
    p = tracked(make());
    p.catch(() => undefined); // handled by the error boundary
    cache.set(key, p);
  }
  return p;
}
onRetry(() => {
  for (const cache of [unitCache, indexCache] as Map<string, Promise<unknown>>[]) for (const [k, p] of cache) if (isFailed(p)) cache.delete(k);
  if (isFailed(notationCache)) notationCache = null;
  if (isFailed(searchIndex)) searchIndex = null;
});

let unitLoader = loadUnit;
/** Tests only: replace the chunk loader (e.g. to simulate a failed download). */
export const setUnitLoaderForTests = (f?: typeof loadUnit) => void (unitLoader = f ?? loadUnit);

export const fetchUnit = (unit: string) => remember(unitCache, unit, () => unitLoader(unit).then((c) => c ?? emptyUnit(unit)));
export const fetchNotation = () => {
  if (!notationCache) {
    notationCache = tracked(loadNotation());
    notationCache.catch(() => undefined);
  }
  return notationCache;
};

/** Indexes over exactly these units (plus the units their lessons show items from). Same promise for the same set. */
export function fetchIndexes(units: string[], withNotation = false): Promise<Indexes> {
  const list = cat.withDeps(units);
  const key = `${list.join(",")}|${withNotation ? "n" : ""}`;
  const cached = indexCache.get(key);
  if (cached) return cached;
  // Every unit already in memory: build now, so the page renders without a loading frame.
  const pending = list.map(fetchUnit);
  const notation = withNotation ? fetchNotation() : null;
  if (pending.every((p) => isDone(p)) && (!notation || isDone(notation))) {
    const ready = settled(buildIndexes(bundleFrom(catalog, pending.map((u) => (u as Tracked<UnitContent>).value!), notation ? (notation as Tracked<NotationEntry[]>).value! : [])));
    indexCache.set(key, ready);
    return ready;
  }
  return remember(indexCache, key, () =>
    Promise.all([Promise.all(pending), notation ?? Promise.resolve([])]).then(([parts, notes]) => buildIndexes(bundleFrom(catalog, parts, notes))),
  );
}

/** The indexes for these units if they are already in memory, else null (lets a click act at once). */
export function peekIndexes(units: string[]): Indexes | null {
  const p = fetchIndexes(units);
  return isDone(p) ? (p as Tracked<Indexes>).value! : null;
}

/** Every unit with content: core units, and supplementary ones only when asked for. */
export const allUnits = (supplementary: boolean) => catalog.contentUnits.filter((u) => supplementary || !u.startsWith("sup-"));

/** Suspends until the units are loaded. Call with a stable list (compute it from route params or the catalogue). */
export function useContent(units: string[], withNotation = false): Indexes {
  return use(fetchIndexes(units, withNotation));
}

let searchIndex: Promise<ReturnType<typeof buildIndex>> | null = null;
/**
 * The search index covers everything. Its documents (titles, short summaries, locations) are built at build time
 * into their own small chunk, so the first search fetches that chunk and the search engine, never the chapters.
 */
export function fetchSearchIndex() {
  if (!searchIndex) {
    searchIndex = tracked(Promise.all([import("virtual:rl-search"), import("../domain/search")]).then(([docs, s]) => s.buildIndex(docs.default)));
    searchIndex.catch(() => undefined);
  }
  return searchIndex;
}
export const useSearchIndex = () => use(fetchSearchIndex());

/** Tests only: forget every cached unit and index, as on a fresh page load. */
export function resetContentCache() {
  unitCache.clear();
  indexCache.clear();
  notationCache = null;
  searchIndex = null;
}

/** Fetches every unit and the notation now, so they are cached for offline use (Settings → Save for offline). */
export const fetchEverything = () => fetchIndexes(allUnits(true), true).then(() => undefined);
