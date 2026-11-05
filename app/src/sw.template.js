// Service worker template (from the NLP Study Lab, extended in Milestone 3A, D-032). vite.config.ts injects two
// file lists and a cache version that hashes every built file's name and content, so any change produces a new cache.
//   PRECACHE  stored at install: app shell, the code of every page, the maths renderer and its woff2 fonts
//   ALL       every built file; chapter content is stored on first use or by "Save for offline" (message "save-all")
const CACHE = "rl-study-lab-__VERSION__";
const PRECACHE = __PRECACHE__;
const ALL = __ALL__;
const scoped = (f) => new URL(f, self.registration.scope).href;
const KNOWN = new Set(ALL.map(scoped));

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

// On update, files that kept their (content-hashed) name are carried over from the old cache, so chapters a
// learner already saved stay available offline; everything else from old versions is deleted.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      for (const key of await caches.keys()) {
        if (!key.startsWith("rl-study-lab-") || key === CACHE) continue;
        const old = await caches.open(key);
        for (const req of await old.keys()) {
          if (KNOWN.has(req.url) && !(await cache.match(req, MATCH))) {
            const res = await old.match(req);
            if (res) await cache.put(req, res);
          }
        }
        await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

// Cache-first for our own files. A file of this version fetched for the first time is stored, so a chapter
// opened once works offline afterwards. Page navigations fall back to the cached app shell when offline.
// ignoreVary: module-script and font requests carry an Origin header the precache requests lack.
const MATCH = { ignoreSearch: true, ignoreVary: true };
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("./", MATCH)));
    return;
  }
  event.respondWith(
    caches.match(req, MATCH).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          const url = new URL(req.url);
          url.search = "";
          if (res.ok && KNOWN.has(url.href)) {
            const copy = res.clone();
            event.waitUntil(caches.open(CACHE).then((c) => c.put(url.href, copy)));
          }
          return res;
        }),
    ),
  );
});

// Settings page: "status" reports how much of the app is stored; "save-all" stores the rest, reporting progress.
async function status() {
  const cache = await caches.open(CACHE);
  let stored = 0;
  for (const f of ALL) if (await cache.match(scoped(f), MATCH)) stored++;
  return { type: "status", stored, total: ALL.length, version: CACHE };
}

self.addEventListener("message", (event) => {
  const reply = (msg) => event.source && event.source.postMessage(msg);
  const kind = event.data && event.data.type;
  if (kind === "status") event.waitUntil(status().then(reply));
  if (kind === "save-all")
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE);
        let failed = 0;
        for (const f of ALL) {
          if (await cache.match(scoped(f), MATCH)) continue;
          try {
            await cache.add(scoped(f));
          } catch {
            failed++;
          }
          reply({ type: "progress", ...(await status()) });
        }
        reply({ ...(await status()), type: "saved", failed });
      })(),
    );
});
