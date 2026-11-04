// IndexedDB persistence (NLP Study Lab convention), using the same versioned envelope, migration and
// corrupt-data backup as persistence.ts. Storage is reached through a tiny key-value interface so the
// logic is unit-tested with an in-memory store; idbStore() is the browser implementation.
import { emptyProgress, type ProgressData } from "../domain/progress";
import { STORAGE_KEY, backupKeyFor, decodeSaved, encodeSaved, recoveredMessage, type LoadResult } from "./persistence";

export interface KVStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

export function memoryStore(initial: Record<string, string> = {}): KVStore & { dump: () => Record<string, string> } {
  const m = new Map(Object.entries(initial));
  return {
    get: async (k) => m.get(k),
    set: async (k, v) => void m.set(k, v),
    del: async (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

const DB = "rl-study-lab";
const STORE = "kv";

export function idbStore(): KVStore {
  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  const run = <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
    open().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const t = db.transaction(STORE, mode);
          const req = fn(t.objectStore(STORE));
          t.oncomplete = () => {
            db.close();
            resolve(req.result);
          };
          t.onerror = () => reject(t.error);
        }),
    );
  return {
    get: (k) => run("readonly", (s) => s.get(k) as IDBRequest<string | undefined>),
    set: (k, v) => run("readwrite", (s) => s.put(v, k)).then(() => undefined),
    del: (k) => run("readwrite", (s) => s.delete(k)).then(() => undefined),
  };
}

/**
 * Loads the profile. If the store is empty but an older localStorage copy exists (`legacy`), that copy is
 * imported once. Unreadable data is kept under a backup key and a fresh profile is started.
 */
export async function loadFromStore(kv: KVStore, legacy?: () => string | null, now = Date.now()): Promise<LoadResult> {
  let text = await kv.get(STORAGE_KEY);
  let imported = false;
  if (text === undefined) {
    const old = legacy?.() ?? null;
    if (!old) return { data: emptyProgress(), status: "fresh" };
    text = old;
    imported = true;
  }
  try {
    const data = decodeSaved(text);
    if (imported) await kv.set(STORAGE_KEY, encodeSaved(data, now));
    return { data, status: "loaded", message: imported ? "Progress saved by an earlier version was moved into this browser's database." : undefined };
  } catch (e) {
    const key = backupKeyFor(now);
    await kv.set(key, text).catch(() => undefined);
    return { data: emptyProgress(), status: "recovered", message: recoveredMessage(e, key) };
  }
}

export async function saveToStore(kv: KVStore, data: ProgressData, now = Date.now()): Promise<boolean> {
  try {
    await kv.set(STORAGE_KEY, encodeSaved(data, now));
    return true;
  } catch {
    return false;
  }
}

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistence(): Promise<"persisted" | "not-persisted" | "unsupported"> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return "unsupported";
  if (await navigator.storage.persisted()) return "persisted";
  return (await navigator.storage.persist()) ? "persisted" : "not-persisted";
}
