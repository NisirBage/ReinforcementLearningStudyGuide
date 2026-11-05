// Talks to the service worker about offline storage (D-032). The page never guesses: the counts come from the
// worker's own cache. Without a controlling worker (development, tests, insecure origins) it says so.
export interface OfflineStatus {
  stored: number;
  total: number;
  failed?: number;
}

const worker = (): ServiceWorker | null => (typeof navigator !== "undefined" && navigator.serviceWorker?.controller) || null;
export const offlineSupported = () => worker() !== null;

/** Sends one message and resolves with the first reply of `until`'s type; `onEach` sees every reply. */
function ask(type: string, until: string, onEach?: (s: OfflineStatus) => void): Promise<OfflineStatus> {
  const sw = worker();
  if (!sw) return Promise.reject(new Error("No service worker controls this page."));
  return new Promise((resolve) => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string } & OfflineStatus;
      if (!d || typeof d.stored !== "number") return;
      onEach?.(d);
      if (d.type === until) {
        navigator.serviceWorker.removeEventListener("message", onMessage);
        resolve(d);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    sw.postMessage({ type });
  });
}

export const offlineStatus = () => ask("status", "status");
export const saveAllOffline = (onProgress: (s: OfflineStatus) => void) => ask("save-all", "saved", onProgress);
