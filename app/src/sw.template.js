// Service worker template (from the NLP Study Lab). vite.config.ts injects the file list and a cache version
// that hashes every built file's name and content, so any change produces a new cache.
const CACHE = "rl-study-lab-__VERSION__";
const PRECACHE = __PRECACHE__;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("rl-study-lab-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cache-first for our own files; page navigations fall back to the cached app shell when offline.
// ignoreVary: module-script and font requests carry an Origin header the precache requests lack.
const MATCH = { ignoreSearch: true, ignoreVary: true };
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("./", MATCH)));
    return;
  }
  event.respondWith(caches.match(req, MATCH).then((hit) => hit || fetch(req)));
});
