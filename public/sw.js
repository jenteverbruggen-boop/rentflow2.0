// Minimal service worker: satisfies Chrome/Samsung Internet WebAPK
// installability. It caches nothing (all data is authenticated and must stay
// fresh); it only shows a small offline page when a navigation fails.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(
          '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RentFlow</title><body style="font-family:system-ui;background:#25211c;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center"><div><h1>Geen verbinding</h1><p>RentFlow heeft internet nodig. Probeer het zo opnieuw.</p></div>',
          { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
        ),
    ),
  );
});
