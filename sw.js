/* The Machinist's Bench — offline service worker.
   Bump CACHE (v1 -> v2 -> ...) whenever you upload a new app.html so phones pick up the update. */
const CACHE = 'machinists-bench-v2';

// Same-origin app shell (relative paths so it works under /Machinist-Bench/).
const SHELL = ['./', './app.html', './icon.png', './manifest.webmanifest'];

// React, fetched from a CDN on first online open, then kept for offline.
const RUNTIME = [
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    // Best-effort: pre-cache React so the very first offline open works too.
    await Promise.all(RUNTIME.map((u) => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isPage = req.mode === 'navigate' || req.destination === 'document';

  if (isPage) {
    // Network-first for the page: fresh when online, cached copy when offline.
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
        return res;
      } catch (e) {
        const cached = await caches.match(req);
        return cached || (await caches.match('./app.html'));
      }
    })());
    return;
  }

  // Cache-first for assets (React, icon): instant, and available offline.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && (res.status === 200 || res.type === 'opaque')) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (e) {
      return cached;
    }
  })());
});
