// RentFlow service worker.
// - /_next/static/* is content-hashed and immutable -> cache-first.
// - App icons -> stale-while-revalidate.
// - Navigations stay network-only (authenticated, must be fresh) and fall
//   back to an offline page with a retry button when the network is down.
// API responses are never cached.
const STATIC_CACHE = "rentflow-static-v1";
const ICON_CACHE = "rentflow-icons-v1";
const KEEP = [STATIC_CACHE, ICON_CACHE];

const OFFLINE_HTML =
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RentFlow</title>' +
  '<body style="font-family:system-ui;background:#25211c;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center">' +
  '<div style="padding:24px"><h1>Geen verbinding</h1><p>RentFlow heeft internet nodig. Controleer je verbinding en probeer opnieuw.</p>' +
  '<button onclick="location.reload()" style="font:inherit;font-weight:600;padding:12px 24px;border:0;border-radius:8px;background:#fff;color:#25211c">Opnieuw proberen</button></div>' +
  '<script>addEventListener("online",()=>location.reload())</script>';

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ICON_CACHE);
  const hit = await cache.match(request);
  const refresh = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  });
  return hit || refresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () => new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }),
      ),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else if (/^\/icon-[\w-]+\.png$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
