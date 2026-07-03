// Minimal service worker — required for the app to qualify as an installable PWA.
// It doesn't cache aggressively since this is a real-time online game
// (we always want fresh data from the network).

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Network-first, no offline caching — the game requires a live connection anyway.
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
