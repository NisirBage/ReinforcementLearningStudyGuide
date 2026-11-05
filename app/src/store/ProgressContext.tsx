// Holds the learner's progress for the React tree. Every change goes through a pure function from
// domain/progress.ts or store/persistence.ts; this file only wires them to state and to IndexedDB.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  emptyProgress, logActivity, recordAttempt, recordAttempts, review, setConceptStatus, toggleBookmark, toggleMarked, visit,
  type Attempt, type ConceptStatus, type ProgressData, type Settings,
} from "../domain/progress";
import { STORAGE_KEY, mergeProgress, parseImport } from "./persistence";
import { idbStore, loadFromStore, saveToStore, type KVStore } from "./idb";

interface Ctx {
  data: ProgressData;
  ready: boolean;
  message?: string; // load-time notice (recovered data, migration)
  saveFailed: boolean;
  setStatus: (concept: string, status: ConceptStatus) => void;
  attempt: (a: Omit<Attempt, "at">) => void;
  /** Attempts that carry their own time (practice sessions); validated like single attempts. */
  recordAttempts: (list: Attempt[]) => void;
  /**
   * A saved slot for work in progress (an open practice session, later an exam), kept in the same database
   * as progress but outside the progress record, so a refresh resumes it and export files never carry it.
   */
  slot: { load: (key: string) => Promise<unknown>; save: (key: string, value: unknown) => Promise<void>; clear: (key: string) => Promise<void> };
  toggleMark: (qid: string) => void; // flag for revision
  toggleBookmark: (qid: string) => void;
  reviewCard: (cardId: string, grade: 0 | 1 | 2 | 3) => void;
  visit: (path: string, title: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  importMerge: (text: string) => void; // throws a readable Error on a bad file
  resetAll: () => void;
}

const ProgressCtx = createContext<Ctx | null>(null);
export const SLOT_PREFIX = "rlsl:slot:";

const legacyLocalStorage = () => {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  } catch {
    return null;
  }
};

interface Props {
  children: ReactNode;
  store?: KVStore; // injected in tests; IndexedDB in the browser
  now?: () => number;
}

export function ProgressProvider({ children, store, now = Date.now }: Props) {
  const kv = useMemo(() => store ?? idbStore(), [store]);
  const [data, setData] = useState<ProgressData>(emptyProgress);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string>();
  const [saveFailed, setSaveFailed] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    let live = true;
    loadFromStore(kv, store ? undefined : legacyLocalStorage)
      .catch(() => ({ data: emptyProgress(), status: "fresh" as const, message: "This browser's database is unavailable; progress will not be saved." }))
      .then((r) => {
        if (!live) return;
        loaded.current = true;
        setData(r.data);
        setMessage(r.message);
        setReady(true);
      });
    return () => {
      live = false;
    };
  }, [kv, store]);

  // Save every change after the first load; never overwrite the stored profile with the empty initial state.
  useEffect(() => {
    if (!loaded.current || !ready) return;
    saveToStore(kv, data, now()).then((ok) => setSaveFailed(!ok));
  }, [data, kv, ready, now]);

  const slot = useMemo(
    () => ({
      load: (key: string) =>
        kv
          .get(SLOT_PREFIX + key)
          .then((text) => (text === undefined ? undefined : JSON.parse(text)))
          .catch(() => undefined), // an unreadable slot is treated as empty
      save: (key: string, value: unknown) => kv.set(SLOT_PREFIX + key, JSON.stringify(value)).catch(() => setSaveFailed(true)),
      clear: (key: string) => kv.del(SLOT_PREFIX + key).catch(() => undefined),
    }),
    [kv],
  );

  const apply = useCallback((fn: (d: ProgressData) => ProgressData) => setData((d) => fn(d)), []);

  const value = useMemo<Ctx>(
    () => ({
      data,
      ready,
      message,
      saveFailed,
      setStatus: (c, s) => apply((d) => setConceptStatus(d, c, s, now())),
      attempt: (a) => apply((d) => recordAttempt(d, { ...a, at: now() })),
      recordAttempts: (list) => apply((d) => recordAttempts(d, list)),
      slot,
      toggleMark: (q) => apply((d) => toggleMarked(d, q)),
      toggleBookmark: (q) => apply((d) => toggleBookmark(d, q)),
      reviewCard: (id, g) => apply((d) => review(d, id, g, now())),
      visit: (path, title) =>
        apply((d) => (d.lastVisited?.path === path ? d : logActivity(visit(d, path, title, now()), { at: now(), kind: "lesson", ref: path, detail: title }))),
      setSettings: (patch) => apply((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
      importMerge: (text) => {
        const incoming = parseImport(text); // throws before anything changes
        apply((d) => mergeProgress(d, incoming));
      },
      resetAll: () => apply(() => emptyProgress()),
    }),
    [data, ready, message, saveFailed, apply, now, slot],
  );
  return <ProgressCtx.Provider value={value}>{children}</ProgressCtx.Provider>;
}

export function useProgress(): Ctx {
  const c = useContext(ProgressCtx);
  if (!c) throw new Error("useProgress outside ProgressProvider");
  return c;
}
