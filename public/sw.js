// No-op service worker. We don't ship a PWA — this file exists only to
// satisfy browsers (or stale registrations from prior localhost projects)
// that probe `/sw.js` and would otherwise fill the server log with 404s.
// If a stale worker is already controlling this origin, this also tells it
// to step aside so the page is no longer intercepted.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Take control immediately and unregister so the browser stops
      // routing fetches through this worker on future loads.
      await self.clients.claim();
      await self.registration.unregister();
    })(),
  );
});
