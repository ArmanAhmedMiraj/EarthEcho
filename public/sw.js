// EarthEcho service worker: keeps the app and the last data it saw on the phone.
// Pages: network first, the saved copy when offline. Built files (hashed names): saved after the first use.
// Data (our /api and the weather, flood and price services): network first, the last saved answer when offline.
const VERSION = "ef-v2";
const DATA_HOSTS = ["api.open-meteo.com", "air-quality-api.open-meteo.com", "flood-api.open-meteo.com", "power.larc.nasa.gov", "earthquake.usgs.gov", "eonet.gsfc.nasa.gov", "www.gdacs.org"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((n) => n !== VERSION).map((n) => caches.delete(n)))).then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const saved = await cache.match(request);
    if (saved) return saved;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response && response.status === 200) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/api/")) return void event.respondWith(networkFirst(request));
    if (url.pathname.startsWith("/assets/")) return void event.respondWith(cacheFirst(request));
    if (request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".json") || url.pathname.endsWith(".webmanifest")) {
      return void event.respondWith(networkFirst(request));
    }
    return void event.respondWith(networkFirst(request));
  }
  if (DATA_HOSTS.includes(url.hostname)) event.respondWith(networkFirst(request));
});
